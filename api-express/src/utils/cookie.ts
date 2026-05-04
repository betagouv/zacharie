import type { Request } from 'express';
import { IS_DEV_OR_TEST } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days in seconds
export const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

function isNativeRequest(req: Request) {
  return req.headers.platform === 'native';
}

function isLocalhostRequest(req: Request) {
  const host = req.headers.host ?? '';
  return host.includes('localhost') || host.includes('127.0.0.1');
}

export function cookieOptions(req: Request) {
  const isNative = isNativeRequest(req);

  if (IS_DEV_OR_TEST) {
    // Cross-origin contexts (web at localhost:3234 -> API at localhost:3235,
    // or native WebView at 127.0.0.1:3000 -> API) need SameSite=None; Secure.
    const crossOrigin = isNative || isLocalhostRequest(req);
    return {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: crossOrigin,
      sameSite: crossOrigin ? ('none' as const) : ('lax' as const),
    };
  }

  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: isNative ? ('none' as const) : ('lax' as const),
  };
}

export function logoutCookieOptions(req: Request) {
  const isNative = isNativeRequest(req);

  if (IS_DEV_OR_TEST) {
    const crossOrigin = isNative || isLocalhostRequest(req);
    return {
      httpOnly: true,
      secure: crossOrigin,
      sameSite: crossOrigin ? ('none' as const) : ('lax' as const),
    };
  }

  return {
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: isNative ? ('none' as const) : ('lax' as const),
  };
}
