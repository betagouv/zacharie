/**
 * Sliced IndexedDB storage for Zustand persist.
 *
 * Instead of storing the entire store as one giant JSON string under a single
 * IndexedDB key, this splits each top-level state key into its own entry
 * as native objects (structured clone, no JSON serialization).
 *
 * Benefits:
 * - No more multi-MB single-key blob
 * - No JSON.stringify/parse — values stored as native objects via structured clone
 * - Only changed slices are written (reference equality check)
 * - Reads are parallelized via getMany
 * - Migrates transparently from the old single-key format
 */
import { get, del, getMany, setMany, keys } from 'idb-keyval';

const PREFIX = 'zs:';
const META_KEY = `${PREFIX}__meta__`;
const OLD_KEY = 'zacharie-zustand-store';

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
): SlicedStorage<S> {
  // Track previous value references so we only write changed slices
  const prevRefs = new Map<string, unknown>();
  // Block writes until the first getItem completes, so early setState calls
  // (e.g. refreshUser before hydration) don't overwrite IDB with empty state.
  let hydrated = false;

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getItem: async (_name): Promise<StorageValue<S> | null> => {
      // ── Try new (sliced) format first ──
      const meta = await get<{ version: number }>(META_KEY);
      if (meta != null) {
        const idbKeys = persistedKeys.map((k) => `${PREFIX}${k}`);
        const values = await getMany(idbKeys);
        const state: Record<string, unknown> = {};
        for (let i = 0; i < persistedKeys.length; i++) {
          if (values[i] != null) {
            state[persistedKeys[i]] = values[i];
            prevRefs.set(persistedKeys[i], values[i]);
          }
        }
        // Clean up legacy key if still around
        del(OLD_KEY).catch(() => {});
        hydrated = true;
        return { state: state as S, version: meta.version };
      }

      // ── Migrate from old single-key format (JSON string → native objects) ──
      const oldData = await get<string>(OLD_KEY);
      if (oldData != null) {
        try {
          const parsed = JSON.parse(oldData);
          const { state, version } = parsed;

          const entries: [IDBValidKey, unknown][] = [];
          for (const key of persistedKeys) {
            if (key in state) {
              entries.push([`${PREFIX}${key}`, state[key]]);
              prevRefs.set(key, state[key]);
            }
          }
          entries.push([META_KEY, { version }]);
          await setMany(entries);
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
    },

    setItem: async (_name, value): Promise<void> => {
      if (!hydrated) return;
      const state = value.state as Record<string, unknown>;
      const entries: [IDBValidKey, unknown][] = [];

      for (const key of persistedKeys) {
        if (!(key in state)) continue;
        const current = state[key];
        // Only write slices whose reference actually changed
        if (current !== prevRefs.get(key)) {
          entries.push([`${PREFIX}${key}`, current]);
          prevRefs.set(key, current);
        }
      }

      if (entries.length > 0) {
        entries.push([META_KEY, { version: value.version }]);
        await setMany(entries);
      }
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
