import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestWithUser } from '~/types/request';

// On compte les tentatives par email (ou par jeton de réinitialisation) : plusieurs utilisateurs
// peuvent partager la même IP (réseau d'une administration, d'une entreprise)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

// Second limiteur, par IP seule : sans lui, une IP peut essayer un mot de passe courant sur des milliers
// d'emails (le limiteur par email ne la freine jamais). La limite est large car une administration
// ou une entreprise peut faire passer beaucoup d'utilisateurs par la même IP. Un compteur par route :
// une rafale d'inscriptions ne doit pas bloquer les connexions de la même IP
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
    windowMs: 15 * 60 * 1000, // 15 minutes
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

// à appeler une fois par route : chaque appel a son propre compteur
// skipSuccessfulRequests : sur /user/login, seules les connexions échouées comptent
export function authIpRateLimit({ skipSuccessfulRequests = false } = {}) {
  return createAuthIpRateLimit({
    limit: process.env.NODE_ENV === 'production' ? 100 : 10000,
    skip: () => process.env.NODE_ENV === 'test',
    skipSuccessfulRequests,
  });
}

// Les routes /admin sont appelées en rafale par l'interface d'administration (listes, dashboard) :
// la limite est large, elle sert seulement à freiner un balayage automatisé
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
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

// Recherche d'un propriétaire initial par email : on compte par utilisateur connecté, pour freiner
// un balayage d'adresses mail
export const trouverPremierDetenteurRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
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
