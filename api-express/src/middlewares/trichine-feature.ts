import type express from 'express';
import { TRICHINE_FEATURE_ENABLED } from '~/config';

// Recherche de trichine : tant que le feature flag n'est pas posé, ses routes n'existent pas.
export function requireTrichineFeature(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!TRICHINE_FEATURE_ENABLED) {
    res.status(404).send({ ok: false, data: null, error: 'Not found' });
    return;
  }
  next();
}
