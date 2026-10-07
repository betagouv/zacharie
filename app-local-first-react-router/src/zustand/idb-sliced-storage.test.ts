import { describe, it, expect, beforeEach, vi } from 'vitest';

const idb = new Map<IDBValidKey, unknown>();
const failures = { get: false, setMany: false };

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: IDBValidKey) => {
    if (failures.get) throw new Error('read failed');
    return idb.get(key);
  }),
  getMany: vi.fn(async (keys: IDBValidKey[]) => keys.map((key) => idb.get(key))),
  setMany: vi.fn(async (entries: [IDBValidKey, unknown][]) => {
    if (failures.setMany) throw new Error('QuotaExceededError');
    for (const [key, value] of entries) idb.set(key, value);
  }),
  del: vi.fn(async (key: IDBValidKey) => {
    idb.delete(key);
  }),
  keys: vi.fn(async () => [...idb.keys()]),
}));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));
vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

import { setMany } from 'idb-keyval';
import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';
import { createSlicedIDBStorage } from './idb-sliced-storage';

type State = { feis: Record<string, unknown>; logs: unknown[] };
const KEYS = ['feis', 'logs'];

beforeEach(() => {
  idb.clear();
  failures.get = false;
  failures.setMany = false;
  vi.clearAllMocks();
});

describe('createSlicedIDBStorage', () => {
  it('reads back the slices written after hydration', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS);
    expect(await storage.getItem('x')).toBeNull();
    await storage.setItem('x', { state: { feis: { a: 1 }, logs: [1] }, version: 10 });

    const fresh = createSlicedIDBStorage<State>(KEYS);
    expect(await fresh.getItem('x')).toEqual({ state: { feis: { a: 1 }, logs: [1] }, version: 10 });
  });

  it('keeps writes blocked, reports the error and warns the user when the read fails', async () => {
    idb.set('zs:__meta__', { version: 10 });
    idb.set('zs:feis', { onDisk: true });
    failures.get = true;

    const storage = createSlicedIDBStorage<State>(KEYS);
    expect(await storage.getItem('x')).toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    await storage.setItem('x', { state: { feis: {}, logs: [] }, version: 10 });
    expect(setMany).not.toHaveBeenCalled();
    expect(idb.get('zs:feis')).toEqual({ onDisk: true });
  });

  it('does not reject, warns the user and retries the failed slices when the write fails', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS);
    await storage.getItem('x');

    const feis = { a: 1 };
    const logs = [1];
    failures.setMany = true;
    await expect(storage.setItem('x', { state: { feis, logs }, version: 10 })).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(vi.mocked(capture).mock.calls[0][1]).toMatchObject({
      extra: { slices: { feis: 1, logs: 1 } },
    });

    // Same references: the failed slices are written again
    failures.setMany = false;
    await storage.setItem('x', { state: { feis, logs }, version: 10 });
    expect(idb.get('zs:feis')).toBe(feis);
    expect(idb.get('zs:logs')).toBe(logs);
  });

  it('reports a write failure to Sentry only once per session', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS);
    await storage.getItem('x');
    failures.setMany = true;
    await storage.setItem('x', { state: { feis: { a: 1 }, logs: [] }, version: 10 });
    await storage.setItem('x', { state: { feis: { a: 2 }, logs: [] }, version: 10 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it('does not restore a ref that a more recent write already replaced', async () => {
    const storage = createSlicedIDBStorage<State>(KEYS);
    await storage.getItem('x');
    const logs: unknown[] = [];

    let rejectFirst: (e: Error) => void = () => {};
    vi.mocked(setMany).mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (rejectFirst = reject))
    );
    const first = storage.setItem('x', { state: { feis: { a: 1 }, logs }, version: 10 });
    const feis2 = { a: 2 };
    await storage.setItem('x', { state: { feis: feis2, logs }, version: 10 });
    rejectFirst(new Error('QuotaExceededError'));
    await first;

    vi.mocked(setMany).mockClear();
    await storage.setItem('x', { state: { feis: feis2, logs }, version: 10 });
    // logs failed in the first write and was not written since: it is retried, feis2 is not
    expect(vi.mocked(setMany).mock.calls[0][0].map(([key]) => key)).toEqual(['zs:logs', 'zs:__meta__']);
  });

  it('supprime les clés zs:* qui ne sont plus persistées', async () => {
    idb.set('zs:__meta__', { version: 10 });
    idb.set('zs:carcasses', { C1: { zacharie_carcasse_id: 'C1' } });
    // clé autrefois persistée, retirée de PERSISTED_KEYS
    idb.set('zs:carcassesRegistry', [{ zacharie_carcasse_id: 'C1' }]);
    // clé hors du préfixe zs: (autre usage d'idb-keyval)
    idb.set('autre-cle', 'conservee');

    const storage = createSlicedIDBStorage(['carcasses']);
    const result = await storage.getItem('zacharie-zustand-store');

    expect(result).toEqual({ state: { carcasses: { C1: { zacharie_carcasse_id: 'C1' } } }, version: 10 });
    await vi.waitFor(() => expect(idb.has('zs:carcassesRegistry')).toBe(false));
    expect(idb.has('zs:carcasses')).toBe(true);
    expect(idb.has('zs:__meta__')).toBe(true);
    expect(idb.get('autre-cle')).toBe('conservee');
  });
});
