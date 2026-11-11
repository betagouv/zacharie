import rateLimit from 'express-rate-limit';
import type { RequestWithUser } from '~/types/request';

// Compté par utilisateur connecté : à monter après passport.authenticate, sinon req.user est absent
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  keyGenerator: (req) => (req as RequestWithUser).user.id,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de dépôts de fichiers, veuillez réessayer dans 15 minutes.',
    data: null,
  },
});
