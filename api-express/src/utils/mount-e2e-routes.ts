import type express from 'express';
import e2eRouter from '~/controllers/e2e';

// Routes réservées aux tests Playwright : jamais montées hors NODE_ENV=test (staging et prod tournent en
// NODE_ENV=production)
export function mountE2eRoutes(app: express.Express, nodeEnv: string | undefined) {
  if (nodeEnv !== 'test') return;
  app.use('/__e2e', e2eRouter);
}
