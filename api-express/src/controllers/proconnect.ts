import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import prisma from '~/prisma';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import { API_URL, APP_URL, SECRET } from '~/config';
import { cookieOptions, logoutCookieOptions } from '~/utils/cookie';
import { signSessionToken } from '~/utils/session-token';
import {
  buildProConnectAuthorization,
  exchangeProConnectCallback,
  isProConnectConfigured,
} from '~/service/proconnect';
import { capture } from '~/third-parties/sentry';

const router: express.Router = express.Router();

// Cookie temporaire entre /start et /callback : porte state, nonce et PKCE, signé et périmé en 10 minutes
const PROCONNECT_STATE_COOKIE = 'zacharie_proconnect';
const PROCONNECT_STATE_MAX_AGE = 60 * 10; // seconds

interface ProConnectStatePayload {
  userId: string;
  state: string;
  nonce: string;
  codeVerifier: string | null;
  redirect: string;
}

// Seules les routes internes de l'app sont acceptées comme destination après ProConnect
function sanitizeRedirect(redirect: unknown): string {
  if (typeof redirect !== 'string') return '/app/admin';
  if (!redirect.startsWith('/app/') || redirect.startsWith('/app//')) return '/app/admin';
  return redirect;
}

function redirectToProConnectPage(res: express.Response, error: string, redirect: string) {
  const url = new URL('/app/proconnect', APP_URL);
  url.searchParams.set('error', error);
  url.searchParams.set('redirect', redirect);
  res.redirect(url.href);
}

// Route: GET /user/proconnect/start - Redirige un admin connecté vers ProConnect
router.get(
  '/start',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const user = req.user!;
    const redirect = sanitizeRedirect(req.query.redirect);
    if (!user.isZacharieAdmin) {
      res.status(403).send({ ok: false, data: null, message: '', error: 'Forbidden' });
      return;
    }
    if (!isProConnectConfigured()) {
      redirectToProConnectPage(res, 'not_configured', redirect);
      return;
    }
    const authorization = await buildProConnectAuthorization(user.email ?? undefined);
    const statePayload: ProConnectStatePayload = {
      userId: user.id,
      state: authorization.state,
      nonce: authorization.nonce,
      codeVerifier: authorization.codeVerifier,
      redirect,
    };
    const stateToken = jwt.sign(statePayload, SECRET, { expiresIn: PROCONNECT_STATE_MAX_AGE });
    res.cookie(PROCONNECT_STATE_COOKIE, stateToken, {
      ...cookieOptions(req),
      maxAge: PROCONNECT_STATE_MAX_AGE * 1000,
    });
    res.redirect(authorization.url);
  })
);

// Route: GET /user/proconnect/callback - Retour de ProConnect, réémet la session avec proconnect_at
router.get(
  '/callback',
  catchErrors(async (req: express.Request, res: express.Response) => {
    const stateToken = req.cookies?.[PROCONNECT_STATE_COOKIE];
    res.clearCookie(PROCONNECT_STATE_COOKIE, logoutCookieOptions(req));
    if (!stateToken) {
      redirectToProConnectPage(res, 'session_expired', '/app/admin');
      return;
    }
    let statePayload: ProConnectStatePayload;
    try {
      statePayload = jwt.verify(stateToken, SECRET) as ProConnectStatePayload;
    } catch {
      redirectToProConnectPage(res, 'session_expired', '/app/admin');
      return;
    }
    const redirect = sanitizeRedirect(statePayload.redirect);

    const user = await prisma.user.findUnique({
      where: { id: statePayload.userId, isZacharieAdmin: true, deleted_at: null },
    });
    if (!user) {
      redirectToProConnectPage(res, 'session_expired', redirect);
      return;
    }

    let identity: Awaited<ReturnType<typeof exchangeProConnectCallback>>;
    try {
      identity = await exchangeProConnectCallback(new URL(req.originalUrl, API_URL), {
        state: statePayload.state,
        nonce: statePayload.nonce,
        codeVerifier: statePayload.codeVerifier,
      });
    } catch (error) {
      capture(error as Error, { extra: { userId: user.id, step: 'proconnect-callback' } });
      redirectToProConnectPage(res, 'proconnect_failed', redirect);
      return;
    }

    // ProConnect authentifie une personne ; c'est l'égalité avec l'email du compte admin qui autorise
    if (identity.email !== user.email?.toLowerCase().trim()) {
      capture(new Error('ProConnect email mismatch'), {
        extra: { userId: user.id, proconnectEmail: identity.email },
      });
      redirectToProConnectPage(res, 'email_mismatch', redirect);
      return;
    }

    const token = signSessionToken({ userId: user.id, proconnect_at: Math.floor(Date.now() / 1000) });
    res.cookie('zacharie_express_jwt', token, cookieOptions(req));
    res.redirect(new URL(redirect, APP_URL).href);
  })
);

export default router;
