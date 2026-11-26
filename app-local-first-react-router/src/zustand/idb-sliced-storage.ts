import { get, del, keys, entries, createStore, promisifyRequest, type UseStore } from 'idb-keyval';
import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';

const PREFIX = 'zs:';
const META_KEY = `${PREFIX}__meta__`;
const OLD_KEY = 'zacharie-zustand-store';
const PERSIST_ERROR_TOAST_ID = 'idb-persist-error';

let keyvalStore: UseStore | null = null;
function getKeyvalStore() {
  keyvalStore ??= createStore('keyval-store', 'keyval');
  return keyvalStore;
}

function resetKeyvalStoreIfConnectionClosed(error: unknown): boolean {
  const closed =
    error instanceof Error &&
    (error.name === 'InvalidStateError' || error.message.includes('connection is closing'));
  if (closed) keyvalStore = null;
  return closed;
}

function writeBatch(puts: Array<[IDBValidKey, unknown]>, deletes: Array<IDBValidKey>): Promise<void> {
  return getKeyvalStore()('readwrite', (store) => {
    for (const [key, value] of puts) store.put(value, key);
    for (const key of deletes) store.delete(key);
    return promisifyRequest(store.transaction);
  });
}

function waitUntilVisible(): Promise<void> {
  if (document.visibilityState === 'visible') return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onChange);
      resolve();
    };
    document.addEventListener('visibilitychange', onChange);
  });
}

async function writeBatchWithRetry(
  puts: Array<[IDBValidKey, unknown]>,
  deletes: Array<IDBValidKey>
): Promise<void> {
  try {
    await writeBatch(puts, deletes);
  } catch (error) {
    if (resetKeyvalStoreIfConnectionClosed(error)) return writeBatch(puts, deletes);
    if (error != null) throw error;
    await waitUntilVisible();
    if (localTeardownInProgress) return;
    try {
      await writeBatch(puts, deletes);
    } catch (retryError) {
      throw retryError ?? new Error('IndexedDB transaction aborted without error');
    }
  }
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
  const prevRefs = new Map<string, unknown>();
  let hydrated = false;
  let writeErrorCaptured = false;
  let nextValue: StorageValue<S> | null = null;
  let writing: Promise<void> | null = null;

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
        orphanKeys.push(idbKey);
      }
      for (const [key, value] of Object.entries(state)) prevRefs.set(key, value);
      del(OLD_KEY).catch(() => {});
      Promise.all(orphanKeys.map((key) => del(key))).catch(() => {});
      hydrated = true;
      return { state: state as S, version: meta.version };
    }

    const oldData = await get<string>(OLD_KEY, getKeyvalStore());
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
      if (current === prevRefs.get(key)) continue;
      const changes = slicePuts(key, current, prevRefs.get(key));
      for (const put of changes.puts) puts.push(put);
      for (const deletion of changes.deletes) deletes.push(deletion);
      previous.set(key, prevRefs.get(key));
      prevRefs.set(key, current);
    }

    if (previous.size === 0) return;
    puts.push([META_KEY, { version: value.version }]);
    try {
      await writeBatchWithRetry(puts, deletes);
    } catch (error) {
      for (const [key, prevRef] of previous) prevRefs.set(key, prevRef);
      if (!writeErrorCaptured) {
        writeErrorCaptured = true;
        capture(error as Error, {
          extra: {
            context: 'idb-sliced setItem',
            visibilityState: document.visibilityState,
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
        try {
          return await readFromIDB();
        } catch (error) {
          if (!resetKeyvalStoreIfConnectionClosed(error)) throw error;
          return await readFromIDB();
        }
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
