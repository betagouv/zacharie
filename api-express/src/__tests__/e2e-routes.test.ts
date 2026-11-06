import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { populateDb } from '../../scripts/populate-test-db';
import { applyHistoryTriggers } from '../../scripts/apply-history-triggers';
import { mountE2eRoutes } from '~/utils/mount-e2e-routes';

// POST /__e2e/reset vide et reseed la base : elle ne doit exister qu'en NODE_ENV=test.
// Staging et review apps tournent en NODE_ENV=production, comme la prod.

vi.mock('../../scripts/populate-test-db', () => ({ populateDb: vi.fn(async () => {}) }));
vi.mock('../../scripts/apply-history-triggers', () => ({ applyHistoryTriggers: vi.fn(async () => {}) }));

function buildApp(nodeEnv: string | undefined) {
  const app = express();
  app.use(express.json());
  mountE2eRoutes(app, nodeEnv);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /__e2e/reset', () => {
  test.each(['production', 'development', undefined])('absente quand NODE_ENV=%s', async (nodeEnv) => {
    const res = await request(buildApp(nodeEnv)).post('/__e2e/reset').send({ role: 'ETG' });
    expect(res.status).toBe(404);
    expect(populateDb).not.toHaveBeenCalled();
    expect(applyHistoryTriggers).not.toHaveBeenCalled();
  });

  // premier appel du process : historyTriggersReady est un état de module
  test('pose les triggers d’historique une seule fois par process', async () => {
    const app = buildApp('test');
    await request(app).post('/__e2e/reset').send({});
    await request(app).post('/__e2e/reset').send({});
    expect(populateDb).toHaveBeenCalledTimes(2);
    expect(applyHistoryTriggers).toHaveBeenCalledTimes(1);
  });

  test('reseed la base avec le rôle demandé quand NODE_ENV=test', async () => {
    const res = await request(buildApp('test')).post('/__e2e/reset').send({ role: 'ETG' });
    expect(res.status).toBe(200);
    expect(populateDb).toHaveBeenCalledWith('ETG');
  });

  test('refuse un rôle qui n’est pas une chaîne', async () => {
    const res = await request(buildApp('test')).post('/__e2e/reset').send({ role: 3 });
    expect(res.status).toBe(400);
    expect(populateDb).not.toHaveBeenCalled();
  });
});
