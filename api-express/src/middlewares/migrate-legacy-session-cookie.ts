import type { NextFunction, Request, Response } from 'express';
import { IS_PRODUCTION, IS_REVIEW_APP, IS_STAGING } from '~/config';
import { cookieOptions, logoutCookieOptions, SESSION_COOKIE_NAME } from '~/utils/cookie';

const LEGACY_COOKIE_NAME = 'zacharie_express_jwt';
const LEGACY_PROCONNECT_STATE_COOKIE = 'zacharie_proconnect';

function legacyCookieDomain() {
  if (IS_PRODUCTION) return '.zacharie.beta.gouv.fr';
  if (IS_STAGING && !IS_REVIEW_APP) return '.zacharie.incubateur.net';
  return null;
}

export function migrateLegacySessionCookie(req: Request, res: Response, next: NextFunction) {
  const domain = legacyCookieDomain();
  if (!domain) {
    next();
    return;
  }
  if (req.cookies?.[LEGACY_PROCONNECT_STATE_COOKIE]) {
    res.clearCookie(LEGACY_PROCONNECT_STATE_COOKIE, { ...logoutCookieOptions(req), domain });
  }
  const legacyToken = req.cookies?.[LEGACY_COOKIE_NAME];
  if (!legacyToken) {
    next();
    return;
  }
  res.clearCookie(LEGACY_COOKIE_NAME, { ...logoutCookieOptions(req), domain });
  if (!req.cookies[SESSION_COOKIE_NAME]) {
    req.cookies[SESSION_COOKIE_NAME] = legacyToken;
    res.cookie(SESSION_COOKIE_NAME, legacyToken, cookieOptions(req));
  }
  next();
}
