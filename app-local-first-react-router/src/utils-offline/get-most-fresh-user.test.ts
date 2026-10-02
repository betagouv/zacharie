import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@prisma/client';

const apiGet = vi.fn();
vi.mock('@app/services/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }));
vi.mock('@app/zustand/store', () => {
  const state = { isOnline: true, users: {} };
  return {
    default: {
      getState: () => state,
      setState: (updater: unknown) => {
        Object.assign(state, typeof updater === 'function' ? updater(state) : updater);
      },
    },
  };
});
vi.mock('@app/zustand/user', () => {
  const state = { user: { id: 'USER-1' } as unknown as User | null };
  return {
    default: {
      getState: () => state,
      setState: (updater: Partial<typeof state>) => Object.assign(state, updater),
      persist: { clearStorage: vi.fn() },
    },
  };
});

import { refreshUser } from './get-most-fresh-user';

describe('refreshUser', () => {
  let goodConnection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet.mockReset();
    goodConnection = vi.fn();
    const target = new EventTarget();
    target.addEventListener('good-connection', goodConnection);
    vi.stubGlobal('window', target);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signale le retour de la connexion quand /user/me répond', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { user: { id: 'USER-1' } } });
    const user = await refreshUser('test');
    expect(user).toEqual({ id: 'USER-1' });
    expect(goodConnection).toHaveBeenCalledTimes(1);
  });

  it("ne signale pas le retour de la connexion quand l'appel échoue (réseau coupé)", async () => {
    apiGet.mockResolvedValue({ ok: false, error: 'erreur réseau' });
    const user = await refreshUser('test');
    expect(user).toBeNull();
    expect(goodConnection).not.toHaveBeenCalled();
  });
});
