import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestWithUser } from '~/types/request';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email === 'string' && email) return `email:${email.trim().toLowerCase()}`;
    const resetPasswordToken = req.body?.resetPasswordToken;
    if (typeof resetPasswordToken === 'string' && resetPasswordToken) return `reset:${resetPasswordToken}`;
    return ipKeyGenerator(req.ip ?? '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de tentatives, veuillez réessayer dans 15 minutes.',
    data: null,
  },
});

export function createAuthIpRateLimit({
  limit,
  skip,
  skipSuccessfulRequests = false,
}: {
  limit: number;
  skip: () => boolean;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: limit,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    message: {
      ok: false,
      error: 'Trop de tentatives, veuillez réessayer dans 15 minutes.',
      data: null,
    },
  });
}

export function authIpRateLimit({ skipSuccessfulRequests = false } = {}) {
  return createAuthIpRateLimit({
    limit: process.env.NODE_ENV === 'production' ? 100 : 10000,
    skip: () => process.env.NODE_ENV === 'test',
    skipSuccessfulRequests,
  });
}

export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de requêtes, veuillez réessayer dans une minute.',
    data: null,
  },
});

export const trouverPremierDetenteurRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  keyGenerator: (req) => {
    const userId = (req as RequestWithUser).user?.id;
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de recherches, veuillez réessayer dans une heure.',
    data: { user: null },
  },
});
