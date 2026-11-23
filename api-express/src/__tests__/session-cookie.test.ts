import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { cookieOptions, logoutCookieOptions, SESSION_COOKIE_NAME } from '~/utils/cookie';
import { migrateLegacySessionCookie } from '~/middlewares/migrate-legacy-session-cookie';

type Env = 'production' | 'staging' | 'review' | 'test';

// l'env est lu à chaque appel ; `SESSION_COOKIE_NAME` est calculé à l'import, donc en production
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

function fakeRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  env.current = 'production';
});

describe('cookie de session', () => {
  it.each(['production', 'staging', 'review'] as const)(
    'en %s : host-only (pas de domain) avec le préfixe __Host-',
    async (e) => {
      env.current = e;
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
});

describe('migration de l’ancien cookie de session (temporaire)', () => {
  it.each([
    ['production', '.zacharie.beta.gouv.fr'],
    ['staging', '.zacharie.incubateur.net'],
  ] as const)(
    'en %s : recopie l’ancien jeton dans le nouveau cookie et efface l’ancien',
    async (e, domain) => {
      env.current = e;
      const req = fakeReq({ zacharie_express_jwt: 'old-token' });
      const res = fakeRes();
      const next = vi.fn() as NextFunction;
      migrateLegacySessionCookie(req, res, next);
      expect(res.clearCookie).toHaveBeenCalledWith(
        'zacharie_express_jwt',
        expect.objectContaining({ domain, secure: true, path: '/' })
      );
      expect(res.cookie).toHaveBeenCalledWith('__Host-zacharie_jwt', 'old-token', expect.anything());
      expect(res.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
      // la requête en cours est authentifiée avec le jeton recopié
      expect(req.cookies['__Host-zacharie_jwt']).toBe('old-token');
      expect(next).toHaveBeenCalled();
    }
  );

  it('garde le nouveau cookie quand les deux sont présents (ancien cookie d’un autre utilisateur)', async () => {
    env.current = 'production';
    const req = fakeReq({ zacharie_express_jwt: 'old-token', '__Host-zacharie_jwt': 'new-token' });
    const res = fakeRes();
    migrateLegacySessionCookie(req, res, vi.fn());
    expect(res.clearCookie).toHaveBeenCalledWith(
      'zacharie_express_jwt',
      expect.objectContaining({ domain: '.zacharie.beta.gouv.fr' })
    );
    expect(res.cookie).not.toHaveBeenCalled();
    expect(req.cookies['__Host-zacharie_jwt']).toBe('new-token');
  });

  it.each(['review', 'test'] as const)('en %s : ne fait rien', async (e) => {
    env.current = e;
    const req = fakeReq({ zacharie_express_jwt: 'token' });
    const res = fakeRes();
    const next = vi.fn();
    migrateLegacySessionCookie(req, res, next);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
