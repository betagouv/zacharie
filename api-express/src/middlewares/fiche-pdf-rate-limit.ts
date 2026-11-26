import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestWithUser } from '~/types/request';

// La génération du PDF bloque le serveur le temps du rendu (jusqu'à quelques secondes pour une grosse
// fiche) : on limite par utilisateur, après l'authentification
export const fichePdfRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  keyGenerator: (req) => {
    const userId = (req as RequestWithUser).user?.id;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req.ip ?? '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de téléchargements, veuillez réessayer dans une minute.',
    data: null,
  },
});
