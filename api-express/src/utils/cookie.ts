import type { Request } from 'express';
import { IS_DEV_OR_TEST, IS_REVIEW_APP } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days in seconds

// Hors dev/test, le cookie de session est host-only sur l'API : le préfixe `__Host-` oblige le navigateur
// à refuser tout attribut `domain`, donc les autres sous-domaines (Metabase…) ne le reçoivent jamais.
// En dev/test le web est en http sur localhost, où Safari refuse un cookie Secure : pas de préfixe.
export const SESSION_COOKIE_NAME = IS_DEV_OR_TEST ? 'zacharie_express_jwt' : '__Host-zacharie_jwt';

function isNativeRequest(req: Request) {
  return req.headers.platform === 'native';
}

// Aucun cookie ne porte d'attribut `domain` : il reste host-only sur l'API, seule à le lire.
export function cookieOptions(req: Request, maxAgeInSeconds = JWT_MAX_AGE) {
  return {
    maxAge: maxAgeInSeconds * 1000,
    ...logoutCookieOptions(req),
  };
}

export function logoutCookieOptions(req: Request) {
  const isNative = isNativeRequest(req);

  if (IS_DEV_OR_TEST) {
    // Le web à localhost:3234 -> API localhost:3235 est same-site : Lax suffit, et sans Secure
    // car Safari refuse un cookie Secure en http même sur localhost.
    // La WebView native (127.0.0.1:3000 -> API) est cross-site : SameSite=None; Secure.
    return {
      httpOnly: true,
      secure: isNative,
      sameSite: isNative ? ('none' as const) : ('lax' as const),
      path: '/',
    };
  }

  if (IS_REVIEW_APP) {
    // l'app (pr-<n>-zacharie.cleverapps.io) et l'API (pr-<n>-zacharie-api.cleverapps.io) sont deux sites :
    // cleverapps.io est un suffixe public, donc SameSite=None pour le cross-site
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };
  }

  // staging et production : l'app (zacharie.…) et l'API (api.zacharie.…) sont same-site
  return {
    httpOnly: true,
    secure: true,
    sameSite: isNative ? ('none' as const) : ('lax' as const),
    path: '/',
  };
}
