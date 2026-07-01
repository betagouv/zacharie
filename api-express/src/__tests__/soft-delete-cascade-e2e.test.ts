import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// Goes through the real /sync orchestrator (sync-fei, sync-carcasse,
// sync-carcasse-intermediaire are NOT mocked here) to verify the soft-delete
// cascade chain end-to-end. After the carcasse-first refactor, the same
// HTTP behavior must hold: a deleted FEI must propagate deleted_at to every
// carcasse + intermediaire row, and subsequent fetches must exclude them.

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

const examinateurInitial = {
  id: 'user-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
  isZacharieAdmin: false,
};

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
};

const FEI_NUMERO = 'FEI-DELETE-1';
const DELETED_AT = '2026-03-15T10:00:00.000Z';

const baseFei: any = {
  numero: FEI_NUMERO,
  examinateur_initial_user_id: examinateurInitial.id,
  fei_current_owner_user_id: examinateurInitial.id,
  deleted_at: null,
  date_mise_a_mort: '2026-03-01',
  Carcasses: [],
  CarcasseIntermediaire: [],
};

const baseCarcasse: any = {
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: FEI_NUMERO,
  numero_bracelet: 'BR-1',
  deleted_at: null,
};

const app = express();
app.use(express.json());
app.use('/sync', syncRouter);
app.use('/carcasse', carcasseRouter);

(prisma.carcasse as any).count = vi.fn().mockResolvedValue(0);
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

// Default required query params for GET /carcasse/ (zod-validated)
const CARCASSE_QS = 'page=0&after=0&limit=100&withDeleted=false';

function authed(req: request.Test, user: object = examinateurInitial) {
  return req.set('x-test-user', JSON.stringify(user));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([]);
  (prisma.carcasse as any).count.mockResolvedValue(0);
  vi.mocked(prisma.carcasse.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.carcasseIntermediaire.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'svi-entity-1' } as any]);
});

describe('FEI soft-delete via POST /sync', () => {
  test('cascades deleted_at to Carcasse + CarcasseIntermediaire in a single request', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue(baseFei as any);
    vi.mocked(prisma.fei.update).mockResolvedValue({
      ...baseFei,
      deleted_at: DELETED_AT,
    } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: FEI_NUMERO, deleted_at: DELETED_AT }],
          carcasses: [],
          carcassesIntermediaires: [],
          logs: [],
        })
    );

    expect(res.status).toBe(200);
    expect(prisma.fei.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { numero: FEI_NUMERO },
        data: { deleted_at: DELETED_AT },
      })
    );
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI_NUMERO },
      data: { deleted_at: DELETED_AT },
    });
    expect(prisma.carcasseIntermediaire.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI_NUMERO },
      data: { deleted_at: DELETED_AT },
    });
  });

  test('unauthorized user → cascade is NOT performed', async () => {
    const otherChasseur = {
      id: 'user-other',
      roles: [UserRoles.CHASSEUR],
      numero_cfei: 'CFEI-OTHER',
      activated: true,
      isZacharieAdmin: false,
    };
    vi.mocked(prisma.fei.findUnique).mockResolvedValue(baseFei as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: FEI_NUMERO, deleted_at: DELETED_AT }],
        }),
      otherChasseur
    );

    // sync.ts swallows the throw via try/catch+capture; the call still returns 200,
    // but the cascade must not run.
    expect(res.status).toBe(200);
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
    expect(prisma.carcasseIntermediaire.updateMany).not.toHaveBeenCalled();
  });

  test('already-deleted FEI → no second cascade fires (idempotent)', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue({
      ...baseFei,
      deleted_at: '2026-02-01T00:00:00Z',
    } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: FEI_NUMERO, deleted_at: DELETED_AT }],
        })
    );

    expect(res.status).toBe(200);
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
    expect(prisma.carcasseIntermediaire.updateMany).not.toHaveBeenCalled();
  });
});

describe('Carcasse soft-delete via POST /sync', () => {
  test('cascades deleted_at to CarcasseIntermediaire only, FEI untouched', async () => {
    // Le /sync pré-charge les fiches des carcasses via fei.findMany (et les passe à syncCarcasse).
    vi.mocked(prisma.fei.findMany).mockResolvedValue([baseFei as any]);
    vi.mocked(prisma.fei.findUnique).mockResolvedValue(baseFei as any);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue(baseCarcasse as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValue({
      ...baseCarcasse,
      deleted_at: DELETED_AT,
    } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            {
              fei_numero: FEI_NUMERO,
              zacharie_carcasse_id: 'ZC-1',
              deleted_at: DELETED_AT,
            },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(prisma.carcasse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: DELETED_AT }),
      })
    );
    expect(prisma.carcasseIntermediaire.updateMany).toHaveBeenCalledWith({
      where: { zacharie_carcasse_id: 'ZC-1' },
      data: { deleted_at: DELETED_AT },
    });
    // FEI must NOT be touched when only the carcasse is deleted
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });
});

describe('GET /carcasse/ after soft-delete', () => {
  // Pin the fetch-side filter: the refactor MUST keep deleted_at-out-of-default
  // for carcasse-first queries, otherwise soft-deletes leak to clients.
  test('GET /carcasse/ default (withDeleted=false) → excludes deleted_at != null rows', async () => {
    await authed(request(app).get(`/carcasse?${CARCASSE_QS}`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.deleted_at).toBeNull();
  });

  test('GET /carcasse/?withDeleted=true&after=... → updated_at gates the delta; deleted_at is not forced null', async () => {
    const cutoff = new Date(DELETED_AT).getTime();
    await authed(request(app).get(`/carcasse?page=0&after=${cutoff}&limit=100&withDeleted=true`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.updated_at).toEqual({ gte: new Date(cutoff) });
    // withDeleted=true ⇒ controller does NOT filter on deleted_at, so soft-deleted
    // rows whose updated_at >= cutoff (deleted_at write also bumps updated_at) are visible.
    expect(where.deleted_at).toBeUndefined();
  });
});
