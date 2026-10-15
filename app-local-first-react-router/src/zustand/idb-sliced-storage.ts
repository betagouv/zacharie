/**
 * Sliced IndexedDB storage for Zustand persist.
 *
 * Instead of storing the entire store as one giant JSON string under a single
 * IndexedDB key, this splits each top-level state key into its own entry
 * as native objects (structured clone, no JSON serialization).
 *
 * - A slice that is a map by id (`recordKeys`) is stored record by record (`zs:carcasses/<id>`):
 *   a change of one carcasse writes that carcasse only, not the 100k others.
 * - Any other slice is stored under one key (`zs:lastUpdateFromServer`).
 * - Only changed slices / records are written (reference equality check), in one transaction
 *   with the meta, so data and cursor are always written together.
 * - Migrates transparently from the old single-key format
 */
import { get, del, keys, entries, createStore, promisifyRequest, type UseStore } from 'idb-keyval';
import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';

const PREFIX = 'zs:';
const META_KEY = `${PREFIX}__meta__`;
const OLD_KEY = 'zacharie-zustand-store';
const PERSIST_ERROR_TOAST_ID = 'idb-persist-error';

// même base et même table que le store par défaut d'idb-keyval (lectures, clearCache)
let keyvalStore: UseStore | null = null;
function getKeyvalStore() {
  keyvalStore ??= createStore('keyval-store', 'keyval');
  return keyvalStore;
}

// écritures et suppressions dans une seule transaction : tout est écrit, ou rien
function writeBatch(puts: Array<[IDBValidKey, unknown]>, deletes: Array<IDBValidKey>): Promise<void> {
  return getKeyvalStore()('readwrite', (store) => {
    for (const [key, value] of puts) store.put(value, key);
    for (const key of deletes) store.delete(key);
    return promisifyRequest(store.transaction);
  });
}

const recordKeyPrefix = (sliceKey: string) => `${PREFIX}${sliceKey}/`;

function warnUserDataNotSaved() {
  toast.error(
    "Les données ne peuvent pas être enregistrées sur cet appareil. Ne fermez pas l'application avant d'être de nouveau en ligne et que vos fiches soient synchronisées.",
    { toastId: PERSIST_ERROR_TOAST_ID, autoClose: false }
  );
}

function describeSlice(value: unknown): number | string {
  if (Array.isArray(value)) return value.length;
  if (value != null && typeof value === 'object') return Object.keys(value).length;
  return typeof value;
}

// Vrai pendant clearLocalAppState() : aucune écriture persistée ni aucun chargement ne doit
// démarrer, sinon des données de l'ancienne session réapparaissent après le nettoyage.
let localTeardownInProgress = false;

export function setLocalTeardownInProgress(inProgress: boolean) {
  localTeardownInProgress = inProgress;
}

export function isLocalTeardownInProgress() {
  return localTeardownInProgress;
}

interface StorageValue<S> {
  state: S;
  version?: number;
}

export interface SlicedStorage<S> {
  getItem: (name: string) => Promise<StorageValue<S> | null>;
  setItem: (name: string, value: StorageValue<S>) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}

export function createSlicedIDBStorage<S extends Record<string, unknown>>(
  persistedKeys: string[],
  recordKeys: string[] = []
): SlicedStorage<S> {
  const isRecordKey = new Set(recordKeys);
  // Track previous value references so we only write changed slices
  const prevRefs = new Map<string, unknown>();
  // Block writes until the first getItem completes, so early setState calls
  // (e.g. refreshUser before hydration) don't overwrite IDB with empty state.
  // If the read fails, writes stay blocked for the whole session: writing would overwrite
  // the data on disk that we could not read.
  let hydrated = false;
  let writeErrorCaptured = false;
  // Une seule écriture à la fois : chaque écriture ne contient que l'écart avec la précédente, donc
  // si une écriture échoue, la suivante doit repartir du dernier état bien écrit. Pendant une
  // écriture, seul le dernier état demandé est gardé pour la suivante.
  let nextValue: StorageValue<S> | null = null;
  let writing: Promise<void> | null = null;

  // Ce qu'il faut écrire pour passer d'une valeur de tranche à l'autre : la tranche entière, ou
  // seulement les enregistrements ajoutés, modifiés (autre référence) ou supprimés.
  const slicePuts = (key: string, current: unknown, prev: unknown) => {
    if (!isRecordKey.has(key)) {
      return { puts: [[`${PREFIX}${key}`, current]] as Array<[IDBValidKey, unknown]>, deletes: [] };
    }
    const records = (current ?? {}) as Record<string, unknown>;
    const prevRecords = (prev ?? {}) as Record<string, unknown>;
    const puts: Array<[IDBValidKey, unknown]> = [];
    const deletes: IDBValidKey[] = [];
    for (const id in records) {
      if (records[id] !== prevRecords[id]) puts.push([`${recordKeyPrefix(key)}${id}`, records[id]]);
    }
    for (const id in prevRecords) {
      if (!(id in records)) deletes.push(`${recordKeyPrefix(key)}${id}`);
    }
    return { puts, deletes };
  };

  const readFromIDB = async (): Promise<StorageValue<S> | null> => {
    // ── Try new (sliced) format first ──
    const allEntries = await entries<IDBValidKey, unknown>(getKeyvalStore());
    const meta = allEntries.find(([key]) => key === META_KEY)?.[1] as { version: number } | undefined;
    if (meta != null) {
      const sliceKeys = persistedKeys.filter((k) => !isRecordKey.has(k)).map((k) => `${PREFIX}${k}`);
      const state: Record<string, unknown> = {};
      for (const key of recordKeys) state[key] = {};
      const orphanKeys: IDBValidKey[] = [];
      for (const [idbKey, value] of allEntries) {
        if (typeof idbKey !== 'string' || !idbKey.startsWith(PREFIX) || idbKey === META_KEY) continue;
        if (sliceKeys.includes(idbKey)) {
          if (value != null) state[idbKey.slice(PREFIX.length)] = value;
          continue;
        }
        const recordKey = recordKeys.find((k) => idbKey.startsWith(recordKeyPrefix(k)));
        if (recordKey) {
          (state[recordKey] as Record<string, unknown>)[idbKey.slice(recordKeyPrefix(recordKey).length)] =
            value;
          continue;
        }
        // clé d'une tranche qui n'est plus persistée (ou plus sous cette forme)
        orphanKeys.push(idbKey);
      }
      for (const [key, value] of Object.entries(state)) prevRefs.set(key, value);
      // Clean up legacy key if still around
      del(OLD_KEY).catch(() => {});
      Promise.all(orphanKeys.map((key) => del(key))).catch(() => {});
      hydrated = true;
      return { state: state as S, version: meta.version };
    }

    // ── Migrate from old single-key format (JSON string → native objects) ──
    const oldData = await get<string>(OLD_KEY);
    if (oldData != null) {
      try {
        const parsed = JSON.parse(oldData);
        const { state, version } = parsed;

        const puts: [IDBValidKey, unknown][] = [];
        for (const key of persistedKeys) {
          if (!(key in state)) continue;
          for (const put of slicePuts(key, state[key], undefined).puts) puts.push(put);
          prevRefs.set(key, state[key]);
        }
        puts.push([META_KEY, { version }]);
        await writeBatch(puts, []);
        await del(OLD_KEY);

        hydrated = true;
        return { state, version };
      } catch (e) {
        console.error('[idb-sliced] migration from old format failed:', e);
        await del(OLD_KEY);
        hydrated = true;
        return null;
      }
    }

    hydrated = true;
    return null;
  };

  const writeState = async (value: StorageValue<S>): Promise<void> => {
    if (localTeardownInProgress) return;
    const state = value.state as Record<string, unknown>;
    const puts: [IDBValidKey, unknown][] = [];
    const deletes: IDBValidKey[] = [];
    const previous = new Map<string, unknown>();

    for (const key of persistedKeys) {
      if (!(key in state)) continue;
      const current = state[key];
      // Only write slices whose reference actually changed
      if (current === prevRefs.get(key)) continue;
      const changes = slicePuts(key, current, prevRefs.get(key));
      // boucles plutôt que push(...) : une tranche peut compter plus de 100 000 enregistrements
      for (const put of changes.puts) puts.push(put);
      for (const deletion of changes.deletes) deletes.push(deletion);
      previous.set(key, prevRefs.get(key));
      prevRefs.set(key, current);
    }

    if (previous.size === 0) return;
    puts.push([META_KEY, { version: value.version }]);
    try {
      await writeBatch(puts, deletes);
    } catch (error) {
      // Restore the refs so the failed slices are written again on the next setItem
      for (const [key, prevRef] of previous) prevRefs.set(key, prevRef);
      if (!writeErrorCaptured) {
        writeErrorCaptured = true;
        capture(error as Error, {
          extra: {
            context: 'idb-sliced setItem',
            slices: Object.fromEntries([...previous.keys()].map((key) => [key, describeSlice(state[key])])),
          },
        });
      }
      warnUserDataNotSaved();
    }
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getItem: async (_name): Promise<StorageValue<S> | null> => {
      try {
        return await readFromIDB();
      } catch (error) {
        capture(error as Error, { extra: { context: 'idb-sliced getItem' } });
        warnUserDataNotSaved();
        return null;
      }
    },

    setItem: (_name, value): Promise<void> => {
      if (!hydrated || localTeardownInProgress) return Promise.resolve();
      nextValue = value;
      writing ??= (async () => {
        while (nextValue) {
          const valueToWrite = nextValue;
          nextValue = null;
          await writeState(valueToWrite);
        }
        writing = null;
      })();
      return writing;
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeItem: async (_name): Promise<void> => {
      const allKeys = await keys();
      const toDelete = allKeys.filter((key) => typeof key === 'string' && key.startsWith(PREFIX));
      await Promise.all(toDelete.map((key) => del(key)));
      await del(OLD_KEY);
      prevRefs.clear();
    },
  };
}
