import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const store = vi.hoisted(() => {
  let state: Record<string, unknown> = { isOnline: false, users: {} };
  return {
    getState: () => state,
    setState: (
      partial: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)
    ) => {
      state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
    },
    reset: (next: Record<string, unknown>) => {
      state = next;
    },
  };
});
const userStore = vi.hoisted(() => {
  let state: { user: { id: string } | null } = { user: { id: 'user-1' } };
  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
    persist: { clearStorage: () => {} },
  };
});
const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@app/zustand/store', () => ({ default: store }));
vi.mock('@app/zustand/user', () => ({ default: userStore }));
vi.mock('@app/services/api', () => ({ default: { get: apiGet } }));
vi.mock('@sentry/react', () => ({ setUser: vi.fn() }));

import { refreshUser } from './get-most-fresh-user';

let fakeWindow: EventTarget;

beforeEach(() => {
  apiGet.mockReset();
  store.reset({ isOnline: false, users: {} });
  fakeWindow = new EventTarget();
  vi.stubGlobal('window', fakeWindow);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshUser hors ligne', () => {
  it("n'appelle pas l'API quand l'appareil est hors ligne", async () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(await refreshUser('test')).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('retente /user/me après une connexion très lente et émet good-connection en cas de succès', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    apiGet.mockResolvedValue({ ok: true, data: { user: { id: 'user-1' } } });
    const goodConnection = vi.fn();
    fakeWindow.addEventListener('good-connection', goodConnection);

    const user = await refreshUser('very-bad-connection-retry');

    expect(apiGet).toHaveBeenCalledWith(expect.objectContaining({ path: '/user/me' }));
    expect(goodConnection).toHaveBeenCalledTimes(1);
    expect(user).toEqual({ id: 'user-1' });
  });

  it("ne signale pas le retour de la connexion quand l'appel échoue (réseau coupé)", async () => {
    vi.stubGlobal('navigator', { onLine: true });
    apiGet.mockResolvedValue({ ok: false, error: 'erreur réseau' });
    const goodConnection = vi.fn();
    fakeWindow.addEventListener('good-connection', goodConnection);

    expect(await refreshUser('test')).toBeNull();
    expect(goodConnection).not.toHaveBeenCalled();
  });
});
