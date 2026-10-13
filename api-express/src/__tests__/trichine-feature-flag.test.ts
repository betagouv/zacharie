import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi } from 'vitest';
import { requireTrichineFeature } from '~/middlewares/trichine-feature';

// Sans VITE_FEATURE_TRICHINE (cas de la production), les routes trichine n'existent pas.

vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  TRICHINE_FEATURE_ENABLED: false,
}));

const handler = vi.fn((_req: express.Request, res: express.Response) => {
  res.status(200).send({ ok: true });
});

const app = express();
app.use('/trichine', requireTrichineFeature, handler);

describe('requireTrichineFeature', () => {
  test('flag coupé → 404 sans atteindre la route', async () => {
    const res = await request(app).get('/trichine/pools');

    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});
