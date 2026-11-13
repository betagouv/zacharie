import express from 'express';
import request from 'supertest';
import * as Sentry from '@sentry/node';
import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { capture } from '~/third-parties/sentry';
import { catchErrors, errorHandlers } from '~/middlewares/errors';

// Les refus attendus de l'API publique v1 (clé non autorisée, demande d'accès absente ou non
// approuvée, paramètres invalides) posent leur code via res.status(4xx) puis next(error) :
// ils ne remontent pas à Sentry. Les 5xx remontent, une seule fois.

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  pickSafeHeaders: (headers: unknown) => headers,
}));

const sentEvents: Array<Sentry.Event> = [];

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@sentry.example.com/1',
    beforeSend: (event) => {
      sentEvents.push(event);
      return null;
    },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  sentEvents.length = 0;
  // en environnement de test, sendError se contente de logger
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const REFUS =
  "Votre demande d'accès n'a pas été approuvée. Si vous pensez que c'est une erreur, veuillez contacter le support.";

const app = express();
app.get(
  '/v1/refus',
  catchErrors(async (_req, res, next) => {
    res.status(400);
    return next(new Error(REFUS));
  })
);
app.get(
  '/v1/interdit',
  catchErrors(async (_req, res, next) => {
    res.status(403);
    return next(new Error("Votre clé n'est pas autorisée à accéder à cette ressource."));
  })
);
app.get(
  '/v1/plantage',
  catchErrors(async () => {
    throw new Error('boom');
  })
);
app.use(errorHandlers);

describe("gestionnaire d'erreurs et Sentry", () => {
  test("un refus 400 de l'API v1 ne remonte pas à Sentry et la réponse est inchangée", async () => {
    const res = await request(app).get('/v1/refus');
    await Sentry.flush(500);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, code: 'APPLICATION_ERROR', error: REFUS });
    expect(capture).not.toHaveBeenCalled();
    expect(sentEvents).toHaveLength(0);
  });

  test("un refus 403 de l'API v1 ne remonte pas à Sentry", async () => {
    const res = await request(app).get('/v1/interdit');
    await Sentry.flush(500);
    expect(res.status).toBe(403);
    expect(capture).not.toHaveBeenCalled();
    expect(sentEvents).toHaveLength(0);
  });

  test('une erreur 500 remonte une seule fois à Sentry', async () => {
    const res = await request(app).get('/v1/plantage');
    await Sentry.flush(500);
    expect(res.status).toBe(500);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(sentEvents).toHaveLength(0);
  });
});
