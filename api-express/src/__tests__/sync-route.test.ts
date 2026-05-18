import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// Mock the three sync functions so we can assert ordering and isolation
// without having to set up prisma for the full data path here.
vi.mock('~/utils/sync-fei', () => ({
  syncFei: vi.fn(),
}));
vi.mock('~/utils/sync-carcasse', () => ({
  syncCarcasse: vi.fn(),
}));
vi.mock('~/utils/sync-carcasse-intermediaire', () => ({
  syncCarcasseIntermediaire: vi.fn(),
}));

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
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';

const examinateurInitial = {
  id: 'user-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
};

const inactiveUser = {
  id: 'user-inactive',
  roles: [UserRoles.CHASSEUR],
  activated: false,
};

const app = express();
app.use(express.json());
app.use('/sync', syncRouter);

function authed(req: request.Test, user: object = examinateurInitial) {
  return req.set('x-test-user', JSON.stringify(user));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
});

describe('POST /sync — auth/activation', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).post('/sync').send({});
    expect(res.status).toBe(401);
  });

  test('non-activated user → 400 with French message', async () => {
    const res = await authed(request(app).post('/sync').send({}), inactiveUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le compte n'est pas activé");
  });
});

describe('POST /sync — ordering', () => {
  test('processes FEIs, then carcasses, then intermediaires (in that order)', async () => {
    const callOrder: string[] = [];
    vi.mocked(syncFei).mockImplementation(async (numero: string) => {
      callOrder.push(`fei:${numero}`);
      return {
        savedFei: { numero } as any,
        existingFei: { numero } as any,
        isDeleted: false,
      };
    });
    vi.mocked(syncCarcasse).mockImplementation(async (_fei, zid: string) => {
      callOrder.push(`carcasse:${zid}`);
      return {
        savedCarcasse: { zacharie_carcasse_id: zid } as any,
        existingCarcasse: { zacharie_carcasse_id: zid } as any,
        isDeleted: false,
      };
    });
    vi.mocked(syncCarcasseIntermediaire).mockImplementation(
      async (_fei, intermediaireId: string, zid: string) => {
        callOrder.push(`ci:${zid}:${intermediaireId}`);
        return { id: `${zid}:${intermediaireId}` } as any;
      }
    );

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'F1' }, { numero: 'F2' }],
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F2', zacharie_carcasse_id: 'C2' },
          ],
          carcassesIntermediaires: [{ fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' }],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(callOrder).toEqual(['fei:F1', 'fei:F2', 'carcasse:C1', 'carcasse:C2', 'ci:C1:I1']);
  });
});

describe('POST /sync — error isolation', () => {
  test('one failing FEI does not block other FEIs, carcasses, or intermediaires', async () => {
    vi.mocked(syncFei).mockImplementation(async (numero: string) => {
      if (numero === 'F-BAD') throw new Error('fei-failed');
      return {
        savedFei: { numero } as any,
        existingFei: { numero } as any,
        isDeleted: false,
      };
    });
    vi.mocked(syncCarcasse).mockResolvedValue({
      savedCarcasse: { zacharie_carcasse_id: 'C1' } as any,
      existingCarcasse: { zacharie_carcasse_id: 'C1' } as any,
      isDeleted: false,
    });
    vi.mocked(syncCarcasseIntermediaire).mockResolvedValue({ id: 'ci-1' } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'F-BAD' }, { numero: 'F-OK' }],
          carcasses: [{ fei_numero: 'F-OK', zacharie_carcasse_id: 'C1' }],
          carcassesIntermediaires: [
            { fei_numero: 'F-OK', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' },
          ],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(syncFei).toHaveBeenCalledTimes(2);
    expect(syncCarcasse).toHaveBeenCalledTimes(1);
    expect(syncCarcasseIntermediaire).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalled();
  });

  test('a failing carcasse does not block intermediaires', async () => {
    vi.mocked(syncCarcasse).mockRejectedValue(new Error('carcasse-failed'));
    vi.mocked(syncCarcasseIntermediaire).mockResolvedValue({ id: 'ci-1' } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [],
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C-BAD' }],
          carcassesIntermediaires: [{ fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' }],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(syncCarcasseIntermediaire).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalled();
  });
});

describe('POST /sync — side effects', () => {
  test('runs FEI side effects only for non-deleted results with an existing FEI', async () => {
    vi.mocked(syncFei)
      .mockResolvedValueOnce({
        savedFei: { numero: 'F1' } as any,
        existingFei: { numero: 'F1' } as any,
        isDeleted: false,
      })
      .mockResolvedValueOnce({
        savedFei: { numero: 'F2' } as any,
        existingFei: { numero: 'F2' } as any,
        isDeleted: true,
      })
      .mockResolvedValueOnce({
        savedFei: { numero: 'F3' } as any,
        existingFei: null,
        isDeleted: false,
      });

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'F1' }, { numero: 'F2' }, { numero: 'F3' }],
          carcasses: [],
          carcassesIntermediaires: [],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    // Only F1 should trigger side effects (F2 is deleted, F3 has no existingFei before save)
    expect(runFeiUpdateSideEffects).toHaveBeenCalledOnce();
  });

  test('runs carcasse side effects only for non-deleted results', async () => {
    vi.mocked(syncCarcasse)
      .mockResolvedValueOnce({
        savedCarcasse: { zacharie_carcasse_id: 'C1' } as any,
        existingCarcasse: { zacharie_carcasse_id: 'C1' } as any,
        isDeleted: false,
      })
      .mockResolvedValueOnce({
        savedCarcasse: { zacharie_carcasse_id: 'C2' } as any,
        existingCarcasse: { zacharie_carcasse_id: 'C2' } as any,
        isDeleted: true,
      });

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [],
          carcasses: [
            { fei_numero: 'F1', zacharie_carcasse_id: 'C1' },
            { fei_numero: 'F1', zacharie_carcasse_id: 'C2' },
          ],
          carcassesIntermediaires: [],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(runCarcasseUpdateSideEffects).toHaveBeenCalledOnce();
  });
});

describe('POST /sync — logs', () => {
  test('upserts each log and returns synced ids', async () => {
    vi.mocked(prisma.log.upsert).mockImplementation(
      (args: any) => Promise.resolve({ id: args.where.id }) as any
    );

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [],
          carcasses: [],
          carcassesIntermediaires: [],
          logs: [
            { id: 'L1', user_id: 'u1', user_role: UserRoles.CHASSEUR, action: 'CREATE' },
            { id: 'L2', user_id: 'u1', user_role: UserRoles.CHASSEUR, action: 'UPDATE' },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(prisma.log.upsert).toHaveBeenCalledTimes(2);
    expect(res.body.data.syncedLogIds).toEqual(['L1', 'L2']);
  });

  test('a failing log does not break the batch', async () => {
    vi.mocked(prisma.log.upsert)
      .mockResolvedValueOnce({ id: 'L1' } as any)
      .mockRejectedValueOnce(new Error('log-failed'));

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [],
          carcasses: [],
          carcassesIntermediaires: [],
          logs: [
            { id: 'L1', user_id: 'u1', user_role: UserRoles.CHASSEUR, action: 'CREATE' },
            { id: 'L-BAD', user_id: 'u1', user_role: UserRoles.CHASSEUR, action: 'CREATE' },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.syncedLogIds).toEqual(['L1']);
    expect(capture).toHaveBeenCalled();
  });
});

describe('POST /sync — response shape', () => {
  test('empty payload → 200 with empty arrays', async () => {
    const res = await authed(request(app).post('/sync').send({}));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      error: '',
      data: {
        feis: [],
        carcasses: [],
        carcassesIntermediaires: [],
        syncedLogIds: [],
      },
    });
    expect(syncFei).not.toHaveBeenCalled();
    expect(syncCarcasse).not.toHaveBeenCalled();
    expect(syncCarcasseIntermediaire).not.toHaveBeenCalled();
  });

  test('returns populated FEIs fetched after saves', async () => {
    vi.mocked(syncFei).mockResolvedValue({
      savedFei: { numero: 'F1' } as any,
      existingFei: { numero: 'F1' } as any,
      isDeleted: false,
    });
    vi.mocked(prisma.fei.findMany).mockResolvedValue([
      { numero: 'F1', date_mise_a_mort: '2026-01-01' } as any,
    ]);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'F1' }],
          carcasses: [],
          carcassesIntermediaires: [],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(prisma.fei.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { numero: { in: ['F1'] } } })
    );
    expect(res.body.data.feis).toEqual([{ numero: 'F1', date_mise_a_mort: '2026-01-01' }]);
  });
});
