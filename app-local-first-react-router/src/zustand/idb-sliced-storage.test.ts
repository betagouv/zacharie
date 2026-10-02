import { describe, test, expect, vi, beforeEach } from 'vitest';

import { createSlicedIDBStorage } from './idb-sliced-storage';

const idb = vi.hoisted(() => new Map<IDBValidKey, unknown>());

vi.mock('idb-keyval', () => ({
  get: async (key: IDBValidKey) => idb.get(key),
  getMany: async (keys: IDBValidKey[]) => keys.map((key) => idb.get(key)),
  setMany: async (entries: [IDBValidKey, unknown][]) => {
    for (const [key, value] of entries) idb.set(key, value);
  },
  del: async (key: IDBValidKey) => {
    idb.delete(key);
  },
  keys: async () => [...idb.keys()],
}));

describe("createSlicedIDBStorage à l'hydratation", () => {
  beforeEach(() => {
    idb.clear();
    idb.set('zs:__meta__', { version: 10 });
    idb.set('zs:carcasses', { C1: { zacharie_carcasse_id: 'C1' } });
    // clé autrefois persistée, retirée de PERSISTED_KEYS
    idb.set('zs:carcassesRegistry', [{ zacharie_carcasse_id: 'C1' }]);
    // clé hors du préfixe zs: (autre usage d'idb-keyval)
    idb.set('autre-cle', 'conservee');
  });

  test('supprime les clés zs:* qui ne sont plus persistées', async () => {
    const storage = createSlicedIDBStorage(['carcasses']);
    const result = await storage.getItem('zacharie-zustand-store');

    expect(result).toEqual({ state: { carcasses: { C1: { zacharie_carcasse_id: 'C1' } } }, version: 10 });
    await vi.waitFor(() => expect(idb.has('zs:carcassesRegistry')).toBe(false));
    expect(idb.has('zs:carcasses')).toBe(true);
    expect(idb.has('zs:__meta__')).toBe(true);
    expect(idb.get('autre-cle')).toBe('conservee');
  });
});
