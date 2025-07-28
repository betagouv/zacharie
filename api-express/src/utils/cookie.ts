import { IS_DEV_OR_TEST } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years in seconds
export const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

export function cookieOptions(secureInDev = true) {
  if (IS_DEV_OR_TEST) {
    return {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: secureInDev,
      sameSite: secureInDev ? ('none' as const) : ('lax' as const),
    };
  }
  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: 'lax' as const,
  };
}

export function logoutCookieOptions(secureInDev = true) {
  if (IS_DEV_OR_TEST) {
    return {
      httpOnly: true,
      secure: secureInDev,
      sameSite: secureInDev ? ('none' as const) : ('lax' as const),
    };
  }
  return {
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: 'lax' as const,
  };
}
