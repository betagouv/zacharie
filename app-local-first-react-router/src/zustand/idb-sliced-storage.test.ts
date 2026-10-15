import { describe, it, expect, beforeEach, vi } from 'vitest';

type Batch = { puts: Array<[IDBValidKey, unknown]>; deletes: IDBValidKey[] };

const idb = new Map<IDBValidKey, unknown>();
const failures = { read: false, write: false };
// transactions d'écriture validées, dans l'ordre
const batches: Batch[] = [];

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: IDBValidKey) => {
    if (failures.read) throw new Error('read failed');
    return idb.get(key);
  }),
  entries: vi.fn(async () => {
    if (failures.read) throw new Error('read failed');
    return [...idb.entries()];
  }),
  del: vi.fn(async (key: IDBValidKey) => {
    idb.delete(key);
  }),
  keys: vi.fn(async () => [...idb.keys()]),
  // une « transaction » : le callback empile ses put/delete, promisifyRequest les valide d'un coup
  createStore: vi.fn(() => (_mode: IDBTransactionMode, callback: (store: unknown) => unknown) => {
    const batch: Batch = { puts: [], deletes: [] };
    return callback({
      put: (value: unknown, key: IDBValidKey) => batch.puts.push([key, value]),
      delete: (key: IDBValidKey) => batch.deletes.push(key),
      transaction: batch,
    });
  }),
  promisifyRequest: vi.fn(async (batch: Batch) => {
    if (failures.write) throw new Error('QuotaExceededError');
    batches.push(batch);
    for (const [key, value] of batch.puts) idb.set(key, value);
    for (const key of batch.deletes) idb.delete(key);
  }),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));
vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

import { promisifyRequest } from 'idb-keyval';
import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';
import { createSlicedIDBStorage, setLocalTeardownInProgress } from './idb-sliced-storage';

type State = { feis: Record<string, unknown>; logs: unknown[] };
const KEYS = ['feis', 'logs'];
const RECORD_KEYS = ['feis'];

const putKeys = (batch: Batch) => batch.puts.map(([key]) => key);

beforeEach(() => {
  idb.clear();
  batches.length = 0;
  failures.read = false;
  failures.write = false;
  vi.clearAllMocks();
  setLocalTeardownInProgress(false);
});

describe('createSlicedIDBStorage', () => {
  it('reads back the slices written after hydration', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    expect(await storage.getItem('x')).toBeNull();
    await storage.setItem('x', { state: { feis: { a: 1 }, logs: [1] }, version: 11 });

    const fresh = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    expect(await fresh.getItem('x')).toEqual({ state: { feis: { a: 1 }, logs: [1] }, version: 11 });
  });

  it('stocke une tranche map par id enregistrement par enregistrement, les autres sur une clé', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    await storage.setItem('x', { state: { feis: { 'ZACH-1': 1, 'ZACH-2': 2 }, logs: [1] }, version: 11 });

    expect(idb.get('zs:feis/ZACH-1')).toBe(1);
    expect(idb.get('zs:feis/ZACH-2')).toBe(2);
    expect(idb.has('zs:feis')).toBe(false);
    expect(idb.get('zs:logs')).toEqual([1]);
  });

  it("n'écrit que les enregistrements modifiés ou ajoutés, et supprime les enregistrements retirés", async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    const unchanged = { id: 'A' };
    const logs: unknown[] = [];
    await storage.setItem('x', {
      state: { feis: { A: unchanged, B: { v: 1 }, C: { v: 1 } }, logs },
      version: 11,
    });

    await storage.setItem('x', {
      state: { feis: { A: unchanged, B: { v: 2 }, D: { v: 1 } }, logs },
      version: 11,
    });

    const last = batches[batches.length - 1];
    expect(putKeys(last)).toEqual(['zs:feis/B', 'zs:feis/D', 'zs:__meta__']);
    expect(last.deletes).toEqual(['zs:feis/C']);
    expect(idb.has('zs:feis/C')).toBe(false);
  });

  it('écrit les enregistrements, les autres tranches et la méta dans une seule transaction', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    await storage.setItem('x', { state: { feis: { A: 1 }, logs: [1] }, version: 11 });

    expect(batches).toHaveLength(1);
    expect(putKeys(batches[0])).toEqual(['zs:feis/A', 'zs:logs', 'zs:__meta__']);
  });

  it("n'écrit rien quand aucune tranche n'a changé de référence", async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    const state = { feis: { A: 1 }, logs: [] };
    await storage.setItem('x', { state, version: 11 });
    await storage.setItem('x', { state: { ...state }, version: 11 });

    expect(batches).toHaveLength(1);
  });

  it('keeps writes blocked, reports the error and warns the user when the read fails', async () => {
    idb.set('zs:__meta__', { version: 11 });
    idb.set('zs:feis/A', { onDisk: true });
    failures.read = true;

    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    expect(await storage.getItem('x')).toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    await storage.setItem('x', { state: { feis: {}, logs: [] }, version: 11 });
    expect(promisifyRequest).not.toHaveBeenCalled();
    expect(idb.get('zs:feis/A')).toEqual({ onDisk: true });
  });

  it('does not reject, warns the user and retries the failed slices when the write fails', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');

    const record = { v: 1 };
    const feis = { A: record };
    const logs = [1];
    failures.write = true;
    await expect(storage.setItem('x', { state: { feis, logs }, version: 11 })).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(vi.mocked(capture).mock.calls[0][1]).toMatchObject({
      extra: { slices: { feis: 1, logs: 1 } },
    });

    // Same references: the failed slices are written again
    failures.write = false;
    await storage.setItem('x', { state: { feis, logs }, version: 11 });
    expect(idb.get('zs:feis/A')).toBe(record);
    expect(idb.get('zs:logs')).toBe(logs);
  });

  it('reports a write failure to Sentry only once per session', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    failures.write = true;
    await storage.setItem('x', { state: { feis: { a: 1 }, logs: [] }, version: 11 });
    await storage.setItem('x', { state: { feis: { a: 2 }, logs: [] }, version: 11 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it("ne perd pas les enregistrements d'une écriture échouée pendant qu'une autre attendait", async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    const recordA = { v: 'A' };
    const recordB = { v: 'B' };
    const logs: unknown[] = [];

    let rejectFirst: (e: Error) => void = () => {};
    vi.mocked(promisifyRequest).mockImplementationOnce(
      () => new Promise<undefined>((_resolve, reject) => (rejectFirst = reject))
    );
    const first = storage.setItem('x', { state: { feis: { A: recordA }, logs }, version: 11 });
    // pendant la première écriture : une autre modification
    const second = storage.setItem('x', { state: { feis: { A: recordA, B: recordB }, logs }, version: 11 });
    // une seule écriture à la fois
    expect(promisifyRequest).toHaveBeenCalledTimes(1);
    rejectFirst(new Error('QuotaExceededError'));
    await Promise.all([first, second]);

    // la seconde écriture repart du dernier état bien écrit : A et B sont sur le disque
    expect(idb.get('zs:feis/A')).toBe(recordA);
    expect(idb.get('zs:feis/B')).toBe(recordB);
    expect(idb.get('zs:logs')).toBe(logs);
  });

  it('pendant une écriture, seul le dernier état demandé est écrit ensuite', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');
    const logs: unknown[] = [];
    const first = storage.setItem('x', { state: { feis: { A: 1 }, logs }, version: 11 });
    storage.setItem('x', { state: { feis: { A: 2 }, logs }, version: 11 });
    const last = storage.setItem('x', { state: { feis: { A: 3 }, logs }, version: 11 });
    await Promise.all([first, last]);

    expect(batches).toHaveLength(2);
    expect(idb.get('zs:feis/A')).toBe(3);
  });

  it('supprime les clés zs:* qui ne sont plus persistées sous cette forme', async () => {
    idb.set('zs:__meta__', { version: 10 });
    // tranche entière de la v10, désormais stockée enregistrement par enregistrement
    idb.set('zs:carcasses', { C1: { zacharie_carcasse_id: 'C1' } });
    idb.set('zs:carcasses/C2', { zacharie_carcasse_id: 'C2' });
    // clé autrefois persistée, retirée de PERSISTED_KEYS
    idb.set('zs:carcassesRegistry', [{ zacharie_carcasse_id: 'C1' }]);
    // clé hors du préfixe zs: (autre usage d'idb-keyval)
    idb.set('autre-cle', 'conservee');

    const storage = createSlicedIDBStorage(['carcasses'], ['carcasses']);
    const result = await storage.getItem('zacharie-zustand-store');

    expect(result).toEqual({
      state: { carcasses: { C2: { zacharie_carcasse_id: 'C2' } } },
      version: 10,
    });
    await vi.waitFor(() => expect(idb.has('zs:carcassesRegistry')).toBe(false));
    await vi.waitFor(() => expect(idb.has('zs:carcasses')).toBe(false));
    expect(idb.has('zs:carcasses/C2')).toBe(true);
    expect(idb.has('zs:__meta__')).toBe(true);
    expect(idb.get('autre-cle')).toBe('conservee');
  });

  it('drops writes while the local teardown is in progress', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS, RECORD_KEYS);
    await storage.getItem('x');

    setLocalTeardownInProgress(true);
    await storage.setItem('x', { state: { feis: { a: 'ancienne session' }, logs: [] }, version: 11 });
    expect(promisifyRequest).not.toHaveBeenCalled();

    setLocalTeardownInProgress(false);
    await storage.setItem('x', { state: { feis: {}, logs: [] }, version: 11 });
    expect(idb.has('zs:feis/a')).toBe(false);
    expect(idb.get('zs:__meta__')).toEqual({ version: 11 });
  });
});
