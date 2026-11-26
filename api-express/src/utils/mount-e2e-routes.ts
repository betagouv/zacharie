import type express from 'express';
import e2eRouter from '~/controllers/e2e';

export function mountE2eRoutes(app: express.Express, nodeEnv: string | undefined) {
  if (nodeEnv !== 'test') return;
  app.use('/__e2e', e2eRouter);
}
