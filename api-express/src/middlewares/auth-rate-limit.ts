import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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
