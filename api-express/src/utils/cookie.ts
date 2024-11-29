export const JWT_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years in seconds
export const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

export function cookieOptions() {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV);
  if (process.env.NODE_ENV === 'development') {
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
  if (process.env.NODE_ENV === 'development') {
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
