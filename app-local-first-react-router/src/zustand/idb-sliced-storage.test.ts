import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clear, get } from 'idb-keyval';
import { createSlicedIDBStorage, setLocalTeardownInProgress } from './idb-sliced-storage';

describe('createSlicedIDBStorage', () => {
  afterEach(async () => {
    setLocalTeardownInProgress(false);
    await clear();
  });

  it('drops writes while the local teardown is in progress', async () => {
    const storage = createSlicedIDBStorage<{ feis: Record<string, string> }>(['feis']);
    await storage.getItem('store');

    setLocalTeardownInProgress(true);
    await storage.setItem('store', { state: { feis: { a: 'ancienne session' } }, version: 1 });
    expect(await get('zs:feis')).toBeUndefined();

    setLocalTeardownInProgress(false);
    const resetFeis = {};
    await storage.setItem('store', { state: { feis: resetFeis }, version: 1 });
    expect(await get('zs:feis')).toEqual({});
  });
});
