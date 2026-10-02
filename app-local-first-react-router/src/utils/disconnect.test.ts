import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from '@app/services/indexed-db';
import { abortSyncData } from './sync-data';
import { prepareLocalDataForUser } from './disconnect';

// prepareLocalDataForUser runs on every successful login. When a 401 kept unsynced local data
// (`keptDataOwnerId`), the data is kept for the same account and wiped for another account.
// We mock the store and the I/O helpers and assert which path runs.
const storeState = vi.hoisted(() => ({
  keptDataOwnerId: null as string | null,
  reset: vi.fn(),
}));
const setState = vi.hoisted(() =>
  vi.fn((partial: Partial<{ keptDataOwnerId: string | null }>) => Object.assign(storeState, partial))
);

vi.mock('@app/zustand/store', () => ({
  default: { getState: () => storeState, setState },
  hydrationPromise: Promise.resolve(),
}));
vi.mock('@app/zustand/user', () => ({ default: { getState: () => ({ user: null }), setState: vi.fn() } }));
vi.mock('@app/services/indexed-db', () => ({ clearCache: vi.fn(() => Promise.resolve()) }));
vi.mock('@app/services/api', () => ({ setNativeAuthToken: vi.fn() }));
vi.mock('@app/zustand/idb-sliced-storage', () => ({ setLocalTeardownInProgress: vi.fn() }));
vi.mock('./load-carcasses', () => ({ abortLoadCarcasses: vi.fn() }));
vi.mock('./load-my-relations', () => ({ abortLoadMyRelations: vi.fn() }));
vi.mock('./sync-data', () => ({ abortSyncData: vi.fn(), hasUnsyncedData: vi.fn() }));

beforeEach(() => {
  vi.useRealTimers();
  storeState.keptDataOwnerId = null;
  storeState.reset.mockClear();
  setState.mockClear();
  vi.mocked(clearCache).mockClear();
  vi.mocked(abortSyncData).mockClear();
});

describe('prepareLocalDataForUser', () => {
  it('does nothing when no data was kept', async () => {
    await prepareLocalDataForUser('user-1');

    expect(clearCache).not.toHaveBeenCalled();
    expect(storeState.reset).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('keeps the local store for the same account and forgets the kept owner', async () => {
    storeState.keptDataOwnerId = 'user-1';

    await prepareLocalDataForUser('user-1');

    expect(clearCache).not.toHaveBeenCalled();
    expect(storeState.reset).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith({ keptDataOwnerId: null });
    expect(storeState.keptDataOwnerId).toBeNull();
  });

  it('clears the local store for another account', async () => {
    vi.useFakeTimers();
    storeState.keptDataOwnerId = 'user-1';

    const promise = prepareLocalDataForUser('user-2');
    await vi.runAllTimersAsync();
    await promise;

    expect(abortSyncData).toHaveBeenCalledWith('login-other-user');
    expect(clearCache).toHaveBeenCalledWith('login-other-user');
    expect(storeState.reset).toHaveBeenCalledTimes(1);
    // The order matters: the store is reset only after the persisted cache is wiped.
    expect(vi.mocked(clearCache).mock.invocationCallOrder[0]).toBeLessThan(
      storeState.reset.mock.invocationCallOrder[0]
    );
  });
});
