import rateLimit from 'express-rate-limit';

const skip = () => process.env.NODE_ENV === 'test';

export const quizWriteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    ok: false,
    error: 'Trop de requêtes, veuillez patienter une minute.',
    data: null,
  },
});

export const quizReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    ok: false,
    error: 'Trop de requêtes, veuillez patienter une minute.',
    data: null,
  },
});
