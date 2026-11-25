import type { Request } from 'express';
import { IS_DEV_OR_TEST, IS_REVIEW_APP } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 90;

export const SESSION_COOKIE_NAME = IS_DEV_OR_TEST ? 'zacharie_express_jwt' : '__Host-zacharie_jwt';

function isNativeRequest(req: Request) {
  return req.headers.platform === 'native';
}

export function cookieOptions(req: Request, maxAgeInSeconds = JWT_MAX_AGE) {
  return {
    maxAge: maxAgeInSeconds * 1000,
    ...logoutCookieOptions(req),
  };
}

export function logoutCookieOptions(req: Request) {
  const isNative = isNativeRequest(req);

  if (IS_DEV_OR_TEST) {
    return {
      httpOnly: true,
      secure: isNative,
      sameSite: isNative ? ('none' as const) : ('lax' as const),
      path: '/',
    };
  }

  if (IS_REVIEW_APP) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };
  }

  return {
    httpOnly: true,
    secure: true,
    sameSite: isNative ? ('none' as const) : ('lax' as const),
    path: '/',
  };
}
