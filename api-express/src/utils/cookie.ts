import { IS_DEV } from '~/config';

export const JWT_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years in seconds
export const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

export function cookieOptions() {
  console.log('IS_DEV', IS_DEV);
  if (IS_DEV) {
    return {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
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

export function logoutCookieOptions() {
  if (IS_DEV) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
    };
  }
  return {
    httpOnly: true,
    secure: true,
    domain: '.zacharie.beta.gouv.fr',
    sameSite: 'lax' as const,
  };
}
