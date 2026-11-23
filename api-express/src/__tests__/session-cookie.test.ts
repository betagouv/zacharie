import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

type Env = 'production' | 'staging' | 'review' | 'test';

// l'env est lu à chaque appel ; `SESSION_COOKIE_NAME` est calculé à l'import, d'où `importCookieModule`
const env = vi.hoisted(() => ({ current: 'production' as Env }));
vi.mock('~/config', () => ({
  get IS_DEV_OR_TEST() {
    return env.current === 'test';
  },
  get IS_PRODUCTION() {
    return env.current === 'production';
  },
  get IS_STAGING() {
    return env.current === 'staging' || env.current === 'review';
  },
  get IS_REVIEW_APP() {
    return env.current === 'review';
  },
}));

function fakeReq(cookies: Record<string, string>, headers: Record<string, string> = {}) {
  return { cookies, headers } as unknown as Request;
}

// réimporte le module pour recalculer `SESSION_COOKIE_NAME` avec l'env courant
async function importCookieModule(e: Env) {
  env.current = e;
  vi.resetModules();
  return vi.importActual<typeof import('~/utils/cookie')>('~/utils/cookie');
}

afterEach(() => {
  env.current = 'production';
});

describe('cookie de session', () => {
  it.each(['production', 'staging', 'review'] as const)(
    'en %s : host-only (pas de domain) avec le préfixe __Host-',
    async (e) => {
      const { cookieOptions, logoutCookieOptions, SESSION_COOKIE_NAME } = await importCookieModule(e);
      expect(SESSION_COOKIE_NAME).toBe('__Host-zacharie_jwt');
      for (const options of [cookieOptions(fakeReq({})), logoutCookieOptions(fakeReq({}))]) {
        expect(options).not.toHaveProperty('domain');
        // exigences du préfixe __Host- : Secure, Path=/, pas de Domain
        expect(options.secure).toBe(true);
        expect(options.path).toBe('/');
        expect(options.httpOnly).toBe(true);
      }
    }
  );

  it('en dev/test : nom sans préfixe, sans Secure ni domain pour le web en http sur localhost', async () => {
    const { cookieOptions, logoutCookieOptions, SESSION_COOKIE_NAME } = await importCookieModule('test');
    expect(SESSION_COOKIE_NAME).toBe('zacharie_express_jwt');
    for (const options of [cookieOptions(fakeReq({})), logoutCookieOptions(fakeReq({}))]) {
      expect(options).not.toHaveProperty('domain');
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    }
    // la WebView native est cross-site : SameSite=None; Secure
    const native = cookieOptions(fakeReq({}, { platform: 'native' }));
    expect(native.secure).toBe(true);
    expect(native.sameSite).toBe('none');
  });
});
