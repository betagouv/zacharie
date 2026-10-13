import { describe, test, expect, vi } from 'vitest';
import type { Carcasse } from '@prisma/client';

const idb = vi.hoisted(() => {
  const map = new Map<IDBValidKey, unknown>();
  map.set('zs:__meta__', { version: 10 });
  map.set('zs:carcasses', {
    VIVANTE: { zacharie_carcasse_id: 'VIVANTE', deleted_at: null },
    SUPPRIMEE: { zacharie_carcasse_id: 'SUPPRIMEE', deleted_at: new Date('2026-05-22T10:00:00.000Z') },
  });
  // ancienne copie persistée, désormais orpheline
  map.set('zs:carcassesRegistry', [{ zacharie_carcasse_id: 'PERIMEE' }]);
  return map;
});

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
vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

import useZustandStore, { hydrationPromise } from '../src/zustand/store';

describe("carcassesRegistry à l'hydratation", () => {
  test('est reconstruit depuis les carcasses non supprimées, sans être relu depuis IndexedDB', async () => {
    await hydrationPromise;

    const ids = useZustandStore.getState().carcassesRegistry.map((c: Carcasse) => c.zacharie_carcasse_id);
    expect(ids).toEqual(['VIVANTE']);
    await vi.waitFor(() => expect(idb.has('zs:carcassesRegistry')).toBe(false));
  });
});
