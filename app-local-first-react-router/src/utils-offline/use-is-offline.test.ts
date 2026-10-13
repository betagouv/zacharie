import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const store = vi.hoisted(() => {
  let state: { isOnline: boolean } = { isOnline: true };
  return {
    getState: () => state,
    setState: (partial: Partial<{ isOnline: boolean }>) => {
      state = { ...state, ...partial };
    },
  };
});
const refreshUser = vi.hoisted(() => vi.fn());
const syncData = vi.hoisted(() => vi.fn());

vi.mock('@app/zustand/store', () => ({ default: store }));
vi.mock('@app/utils/sync-data', () => ({ syncData }));
vi.mock('@app/utils-offline/get-most-fresh-user', () => ({ refreshUser }));

let fakeWindow: EventTarget;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  refreshUser.mockReset();
  syncData.mockReset();
  fakeWindow = new EventTarget();
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('navigator', { onLine: true });
  await import('./use-is-offline');
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('retour en ligne après une connexion très lente', () => {
  it('passe hors ligne et appelle refreshUser toutes les 30 s', () => {
    fakeWindow.dispatchEvent(new Event('very-bad-connection'));
    expect(store.getState().isOnline).toBe(false);
    expect(refreshUser).not.toHaveBeenCalled();

    vi.advanceTimersByTime(29_999);
    expect(refreshUser).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refreshUser).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(refreshUser).toHaveBeenCalledTimes(2);
  });

  it("ne crée qu'un seul intervalle si l'événement se répète", () => {
    fakeWindow.dispatchEvent(new Event('very-bad-connection'));
    fakeWindow.dispatchEvent(new Event('very-bad-connection'));
    vi.advanceTimersByTime(30_000);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("arrête les tentatives et repasse en ligne à l'événement good-connection", () => {
    fakeWindow.dispatchEvent(new Event('very-bad-connection'));
    vi.advanceTimersByTime(30_000);
    expect(refreshUser).toHaveBeenCalledTimes(1);

    fakeWindow.dispatchEvent(new Event('good-connection'));
    expect(store.getState().isOnline).toBe(true);
    expect(syncData).toHaveBeenCalledWith('is-online');

    vi.advanceTimersByTime(120_000);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("arrête les tentatives à l'événement online", () => {
    fakeWindow.dispatchEvent(new Event('very-bad-connection'));
    fakeWindow.dispatchEvent(new Event('online'));
    expect(store.getState().isOnline).toBe(true);

    vi.advanceTimersByTime(120_000);
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('ne lance pas de tentatives pour un simple événement offline', () => {
    fakeWindow.dispatchEvent(new Event('offline'));
    expect(store.getState().isOnline).toBe(false);

    vi.advanceTimersByTime(120_000);
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
