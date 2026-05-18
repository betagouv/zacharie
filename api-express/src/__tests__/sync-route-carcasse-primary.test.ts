import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// Sister to sync-route.test.ts. Where that file pins the *current* FEI-first
// ordering, this one pins the contract from the perspective of the upcoming
// carcasse-first refactor: the route must still accept partial payloads
// (e.g. carcasses-only, intermediaires-only) and must not blow up when the
// FEI array is absent or empty.

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

import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';

const chasseur = {
  id: 'user-1',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
};

const app = express();
app.use(express.json());
app.use('/sync', syncRouter);

function authed(req: request.Test) {
  return req.set('x-test-user', JSON.stringify(chasseur));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  vi.mocked(syncFei).mockResolvedValue({
    savedFei: { numero: 'F1' } as any,
    existingFei: { numero: 'F1' } as any,
    isDeleted: false,
  });
  vi.mocked(syncCarcasse).mockImplementation(async (_fei, zid) => ({
    savedCarcasse: { zacharie_carcasse_id: zid } as any,
    existingCarcasse: { zacharie_carcasse_id: zid } as any,
    isDeleted: false,
  }));
  vi.mocked(syncCarcasseIntermediaire).mockImplementation(
    async (_f, _i, zid) =>
      ({
        zacharie_carcasse_id: zid,
      }) as any
  );
});

describe('Carcasse-primary payload shapes', () => {
  test('feis omitted entirely → carcasses still processed', async () => {
    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(syncFei).not.toHaveBeenCalled();
    expect(syncCarcasse).toHaveBeenCalledTimes(2);
  });

  test('feis=[] + carcassesIntermediaires only → only intermediaires are processed', async () => {
    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [],
          carcasses: [],
          carcassesIntermediaires: [
            { fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C2' },
          ],
        })
    );
    expect(res.status).toBe(200);
    expect(syncFei).not.toHaveBeenCalled();
    expect(syncCarcasse).not.toHaveBeenCalled();
    expect(syncCarcasseIntermediaire).toHaveBeenCalledTimes(2);
  });

  test('carcasses + intermediaires (no FEIs) → carcasses processed BEFORE intermediaires', async () => {
    const callOrder: string[] = [];
    vi.mocked(syncCarcasse).mockImplementation(async (_fei, zid) => {
      callOrder.push(`carcasse:${zid}`);
      return {
        savedCarcasse: { zacharie_carcasse_id: zid } as any,
        existingCarcasse: { zacharie_carcasse_id: zid } as any,
        isDeleted: false,
      };
    });
    vi.mocked(syncCarcasseIntermediaire).mockImplementation(async (_f, intId, zid) => {
      callOrder.push(`ci:${zid}:${intId}`);
      return { zacharie_carcasse_id: zid } as any;
    });

    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' },
          ],
          carcassesIntermediaires: [
            { fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C2' },
          ],
        })
    );

    expect(callOrder).toEqual(['carcasse:C1', 'carcasse:C2', 'ci:C1:I1', 'ci:C2:I1']);
  });
});

describe('Identity forwarding (refactor will mutate field names — pin this)', () => {
  test('zacharie_carcasse_id and fei_numero are forwarded verbatim to syncCarcasse', async () => {
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            {
              fei_numero: 'FEI-ABCDEF',
              zacharie_carcasse_id: 'ZC-XYZ',
              numero_bracelet: 'BR-42',
            },
          ],
        })
    );

    const call = vi.mocked(syncCarcasse).mock.calls[0];
    expect(call[0]).toBe('FEI-ABCDEF'); // fei_numero positional arg
    expect(call[1]).toBe('ZC-XYZ'); // zacharie_carcasse_id positional arg
    expect(call[2]).toMatchObject({
      fei_numero: 'FEI-ABCDEF',
      zacharie_carcasse_id: 'ZC-XYZ',
      numero_bracelet: 'BR-42',
    });
    expect(call[3]).toMatchObject({ id: chasseur.id });
  });

  test('composite identity (fei_numero, intermediaire_id, zacharie_carcasse_id) is forwarded to syncCarcasseIntermediaire', async () => {
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcassesIntermediaires: [
            {
              fei_numero: 'FEI-A',
              intermediaire_id: 'INT-Z',
              zacharie_carcasse_id: 'ZC-Q',
              prise_en_charge_at: '2026-04-01T08:00:00Z',
            },
          ],
        })
    );

    const call = vi.mocked(syncCarcasseIntermediaire).mock.calls[0];
    expect(call[0]).toBe('FEI-A');
    expect(call[1]).toBe('INT-Z');
    expect(call[2]).toBe('ZC-Q');
    expect(call[3]).toMatchObject({
      fei_numero: 'FEI-A',
      intermediaire_id: 'INT-Z',
      zacharie_carcasse_id: 'ZC-Q',
    });
  });
});

describe('Side effects on carcasse-only payload', () => {
  test('runs carcasse side effects when only carcasses are sent (no FEI side effects)', async () => {
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C1' }],
        })
    );
    expect(runCarcasseUpdateSideEffects).toHaveBeenCalledOnce();
  });

  test('a single failing carcasse does not prevent the others from being saved AND side-effected', async () => {
    vi.mocked(syncCarcasse)
      .mockResolvedValueOnce({
        savedCarcasse: { zacharie_carcasse_id: 'C1' } as any,
        existingCarcasse: { zacharie_carcasse_id: 'C1' } as any,
        isDeleted: false,
      })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        savedCarcasse: { zacharie_carcasse_id: 'C3' } as any,
        existingCarcasse: { zacharie_carcasse_id: 'C3' } as any,
        isDeleted: false,
      });

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' }, // fails
            { fei_numero: 'F1', zacharie_carcasse_id: 'C3' },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(syncCarcasse).toHaveBeenCalledTimes(3);
    // C2 failed → only C1 and C3 trigger side effects
    expect(runCarcasseUpdateSideEffects).toHaveBeenCalledTimes(2);
    expect(res.body.data.carcasses).toHaveLength(2);
    expect(res.body.data.carcasses.map((c: any) => c.zacharie_carcasse_id)).toEqual(['C1', 'C3']);
  });
});

describe('Response shape preserved for partial payloads', () => {
  test('empty body → 200 + canonical empty data envelope (no crash on missing keys)', async () => {
    const res = await authed(request(app).post('/sync').send({}));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      error: '',
      data: { feis: [], carcasses: [], carcassesIntermediaires: [], syncedLogIds: [] },
    });
  });

  test('carcasses-only payload → response.feis is [], response.carcasses contains the saved rows', async () => {
    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' },
          ],
        })
    );
    expect(res.body.data.feis).toEqual([]);
    expect(res.body.data.carcasses).toHaveLength(2);
    expect(prisma.fei.findMany).not.toHaveBeenCalled();
  });
});
