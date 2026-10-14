import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    feis: {} as Record<string, { numero: string; is_synced: boolean; updated_at: Date }>,
    carcasses: {},
    carcassesIntermediaireById: {},
    modifRequestsByCarcasseId: {},
    logs: [] as Array<{ id: string; is_synced: boolean }>,
    dataIsSynced: false,
    syncRejections: [] as Array<{ kind: string; id: string; reason: string; updated_at: number }>,
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

import { abortSyncData, syncData } from './sync-data';

describe('syncData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    abortSyncData('test');
    mocks.state.feis = { 'ZACH-1': { numero: 'ZACH-1', is_synced: false, updated_at: new Date(1000) } };
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

  describe('refus du serveur', () => {
    const refus = { kind: 'fei', id: 'ZACH-1', reason: 'Version obsolète' };
    const sentFeis = (call: number) =>
      mocks.post.mock.calls[call][0].body.feis.map((f: { numero: string }) => f.numero);

    beforeEach(() => {
      mocks.post.mockResolvedValueOnce({
        ok: true,
        data: { syncedLogIds: [], rejected: [refus] },
        error: '',
      });
      mocks.post.mockResolvedValue({ ok: true, data: { syncedLogIds: [], rejected: [] }, error: '' });
    });

    it('garde le refus avec la version refusée', async () => {
      await syncData('test');
      expect(mocks.state.syncRejections).toEqual([{ ...refus, updated_at: 1000 }]);
    });

    it('ne renvoie pas la version refusée', async () => {
      await syncData('test');
      await syncData('test');
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.state.dataIsSynced).toBe(true);
    });

    it('envoie une nouvelle modification de l’item refusé et retire le refus de l’alerte', async () => {
      await syncData('test');
      mocks.state.feis['ZACH-1'] = { numero: 'ZACH-1', is_synced: false, updated_at: new Date(2000) };
      await syncData('test');
      expect(mocks.post).toHaveBeenCalledTimes(2);
      expect(sentFeis(1)).toEqual(['ZACH-1']);
      expect(mocks.state.syncRejections).toEqual([]);
    });

    it('garde le refus quand la version serveur a remplacé la modification', async () => {
      await syncData('test');
      mocks.state.feis['ZACH-1'] = { numero: 'ZACH-1', is_synced: true, updated_at: new Date(1500) };
      await syncData('test');
      expect(mocks.state.syncRejections).toEqual([{ ...refus, updated_at: 1000 }]);
    });
  });
});
