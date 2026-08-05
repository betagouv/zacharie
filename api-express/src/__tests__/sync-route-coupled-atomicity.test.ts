import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// Atomicité de la prise en charge : une carcasse dont le CarcasseIntermediaire arrive dans le même
// payload est persistée AVEC lui dans une transaction. Si l'intermédiaire échoue, la transaction
// rollback → la carcasse n'est pas commitée (pas d'ownership orphelin), et l'échec d'une carcasse
// couplée n'affecte pas les autres.

vi.mock('~/utils/sync-fei', () => ({ syncFei: vi.fn() }));
vi.mock('~/utils/sync-carcasse', () => ({ syncCarcasse: vi.fn() }));
vi.mock('~/utils/sync-carcasse-intermediaire', () => ({ syncCarcasseIntermediaire: vi.fn() }));
vi.mock('~/utils/fei-side-effects', () => ({
  runFeiUpdateSideEffects: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/carcasse-side-effects', () => ({
  runCarcasseUpdateSideEffects: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';

const etg = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
};

const app = express();
app.use(express.json());
app.use('/sync', syncRouter);

function authed(req: request.Test) {
  return req.set('x-test-user', JSON.stringify(etg));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(syncCarcasse).mockImplementation(async (_fei, zid) => ({
    savedCarcasse: { zacharie_carcasse_id: zid } as any,
    existingCarcasse: { zacharie_carcasse_id: zid } as any,
    isDeleted: false,
  }));
  vi.mocked(syncCarcasseIntermediaire).mockImplementation(
    async (_f, intId, zid) => ({ id: `${zid}:${intId}`, zacharie_carcasse_id: zid }) as any
  );
});

describe('POST /sync — coupled prise-en-charge atomicity', () => {
  test('coupled carcasse + intermediaire go through a single $transaction', async () => {
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C1' }],
          carcassesIntermediaires: [{ fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' }],
        })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(syncCarcasse).toHaveBeenCalledTimes(1);
    expect(syncCarcasseIntermediaire).toHaveBeenCalledTimes(1);
    // La carcasse et l'intermédiaire reçoivent le même client transactionnel.
    const carcasseTx = vi.mocked(syncCarcasse).mock.calls[0][4]?.tx;
    const intermediaireTx = vi.mocked(syncCarcasseIntermediaire).mock.calls[0][4];
    expect(carcasseTx).toBeDefined();
    expect(intermediaireTx).toBe(carcasseTx);
  });

  test('a failing coupled intermediaire discards its carcasse (rollback) without touching others', async () => {
    // C1 : intermédiaire couplé qui échoue → carcasse C1 non commitée.
    // C2 : intermédiaire couplé qui réussit → carcasse C2 commitée.
    // C3 : pas d'intermédiaire couplé → chemin rapide, commitée.
    vi.mocked(syncCarcasseIntermediaire).mockImplementation(async (_f, _intId, zid) => {
      if (zid === 'C1') throw new Error("L'établissement du destinataire est obligatoire");
      return { id: `${zid}:I`, zacharie_carcasse_id: zid } as any;
    });

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C3' },
          ],
          carcassesIntermediaires: [
            { fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', intermediaire_id: 'I2', zacharie_carcasse_id: 'C2' },
          ],
        })
    );

    expect(res.status).toBe(200);
    // C1 rollback : absente de la réponse et pas de side-effects. C2 (couplée OK) + C3 (non couplée) présentes.
    const ids = res.body.data.carcasses.map((c: any) => c.zacharie_carcasse_id).sort();
    expect(ids).toEqual(['C2', 'C3']);
    expect(res.body.data.carcassesIntermediaires.map((ci: any) => ci.zacharie_carcasse_id).sort()).toEqual([
      'C2',
    ]);
    expect(runCarcasseUpdateSideEffects).toHaveBeenCalledTimes(2);
  });

  test('an uncoupled intermediaire (carcasse not in payload) still uses the plain path (no transaction)', async () => {
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C1' }],
          carcassesIntermediaires: [
            // ZC-OTHER n'est pas dans carcasses[] → intermédiaire non couplé, traité hors transaction.
            { fei_numero: 'F1', intermediaire_id: 'I9', zacharie_carcasse_id: 'ZC-OTHER' },
          ],
        })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(syncCarcasse).toHaveBeenCalledTimes(1);
    expect(syncCarcasseIntermediaire).toHaveBeenCalledTimes(1);
    // Appel hors transaction → 4 arguments seulement (pas de tx).
    expect(vi.mocked(syncCarcasseIntermediaire).mock.calls[0][4]).toBeUndefined();
  });
});
