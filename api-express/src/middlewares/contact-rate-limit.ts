import rateLimit from 'express-rate-limit';

// Formulaire de contact public : chaque envoi crée un contact Brevo et un email vers contact@
export const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    ok: false,
    error: 'Trop de messages envoyés, veuillez réessayer dans une heure.',
    data: null,
  },
});
