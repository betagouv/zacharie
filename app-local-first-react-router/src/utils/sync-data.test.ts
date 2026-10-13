import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    feis: {} as Record<string, { numero: string; is_synced: boolean }>,
    carcasses: {},
    carcassesIntermediaireById: {},
    modifRequestsByCarcasseId: {},
    logs: [] as Array<{ id: string; is_synced: boolean }>,
    dataIsSynced: false,
  };
  return {
    state,
    post: vi.fn(),
    loadCarcasses: vi.fn(),
    capture: vi.fn(),
  };
});

vi.mock('@app/zustand/store', () => ({
  default: {
    getState: () => mocks.state,
    setState: (update: object | ((s: typeof mocks.state) => object)) => {
      Object.assign(mocks.state, typeof update === 'function' ? update(mocks.state) : update);
    },
  },
  hydrationPromise: Promise.resolve(),
}));
vi.mock('@app/zustand/user', () => ({ syncProchainBraceletAUtiliser: vi.fn() }));
vi.mock('@app/services/api', () => ({ default: { post: mocks.post } }));
vi.mock('@app/services/sentry', () => ({ capture: mocks.capture }));
vi.mock('./load-carcasses', () => ({ loadCarcasses: mocks.loadCarcasses }));

import { syncData } from './sync-data';

describe('syncData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.state.feis = { 'ZACH-1': { numero: 'ZACH-1', is_synced: false } };
    mocks.state.logs = [];
  });

  it('ne recharge pas les données serveur quand le push échoue', async () => {
    mocks.post.mockResolvedValue({ ok: false, data: null, error: 'Erreur serveur' });
    await syncData('test');
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.loadCarcasses).not.toHaveBeenCalled();
  });

  it('ne recharge pas les données serveur quand le push lève une erreur', async () => {
    mocks.post.mockRejectedValue(new Error('boom'));
    await syncData('test');
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.loadCarcasses).not.toHaveBeenCalled();
  });

  it('recharge les données serveur après un push réussi', async () => {
    mocks.post.mockResolvedValue({ ok: true, data: { syncedLogIds: [], rejected: [] }, error: '' });
    await syncData('test');
    expect(mocks.loadCarcasses).toHaveBeenCalledTimes(1);
  });

  it('recharge les données serveur quand il n’y a rien à pousser', async () => {
    mocks.state.feis = {};
    await syncData('test');
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.loadCarcasses).toHaveBeenCalledTimes(1);
  });
});
