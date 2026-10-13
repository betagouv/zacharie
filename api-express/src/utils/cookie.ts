import type { Request } from 'express';
import { IS_DEV_OR_TEST, IS_STAGING } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days in seconds
// session ouverte par une app tierce via un access token (clé API) : volontairement courte
export const ACCESS_TOKEN_SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

function isNativeRequest(req: Request) {
  return req.headers.platform === 'native';
}

export function cookieOptions(req: Request, maxAgeInSeconds = JWT_MAX_AGE) {
  const isNative = isNativeRequest(req);
  const maxAge = maxAgeInSeconds * 1000;

  if (IS_DEV_OR_TEST) {
    // Le web à localhost:3234 -> API localhost:3235 est same-site : Lax suffit, et sans Secure
    // car Safari refuse un cookie Secure en http même sur localhost.
    // La WebView native (127.0.0.1:3000 -> API) est cross-site : SameSite=None; Secure.
    return {
      maxAge,
      httpOnly: true,
      secure: isNative,
      sameSite: isNative ? ('none' as const) : ('lax' as const),
    };
  }

  if (IS_STAGING) {
    return {
      maxAge,
      httpOnly: true,
      secure: true,
      domain: '.zacharie.incubateur.net',
      sameSite: isNative ? ('none' as const) : ('lax' as const),
    };
  }
  // now IS_PRODUCTION
  return {
    maxAge,
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: isNative ? ('none' as const) : ('lax' as const),
  };
}

export function logoutCookieOptions(req: Request) {
  const isNative = isNativeRequest(req);

  if (IS_DEV_OR_TEST) {
    return {
      httpOnly: true,
      secure: isNative,
      sameSite: isNative ? ('none' as const) : ('lax' as const),
    };
  }

  if (IS_STAGING) {
    return {
      httpOnly: true,
      secure: true,
      domain: '.zacharie.incubateur.net',
      sameSite: isNative ? ('none' as const) : ('lax' as const),
    };
  }
  // now IS_PRODUCTION
  return {
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: isNative ? ('none' as const) : ('lax' as const),
  };
}
