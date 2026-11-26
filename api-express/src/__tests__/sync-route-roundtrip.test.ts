import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import prisma from '~/prisma';
import { Carcasse, Fei, UserRoles } from '@prisma/client';

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

const { permissiveScope } = vi.hoisted(() => ({
  permissiveScope: {
    entityIds: ['entity-A', 'entity-B'],
    prefetch: async () => {},
    canWriteCarcasse: async () => true,
    grant: () => {},
    outOfScope: async () => [],
    isFeiOwner: () => true,
    isPremierDetenteur: () => true,
    canWriteFei: async () => true,
  },
}));
vi.mock('~/utils/sync-scope', () => ({ createSyncScope: vi.fn(async () => permissiveScope) }));

const examinateurInitial = {
  id: 'user-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
  isZacharieAdmin: false,
};

const app = express();
app.use(express.json());
app.use('/sync', syncRouter);

const authed = (req: request.Test) => req.set('x-test-user', JSON.stringify(examinateurInitial));

const FEI = 'FEI-RT';
const ZC = 'ZC-RT';

const baseFei: Partial<Fei> = {
  numero: FEI,
  deleted_at: null,
  examinateur_initial_user_id: examinateurInitial.id,
};

const baseCarcasse: Partial<Carcasse> = {
  zacharie_carcasse_id: ZC,
  fei_numero: FEI,
  numero_bracelet: 'BR-RT',
  deleted_at: null,
  is_synced: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { entity_id: 'entity-A' },
    { entity_id: 'entity-B' },
  ] as any);
});

describe('POST /sync — round-trip (real utils against mocked prisma)', () => {
  test('fresh FEI + carcasse + intermediaire → response keys match client store hydration', async () => {
    vi.mocked(prisma.fei.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(baseFei as any);
    vi.mocked(prisma.fei.create).mockResolvedValueOnce(baseFei as any);

    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue(baseCarcasse as any);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(baseCarcasse as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse as any);

    const savedCi = {
      fei_numero: FEI,
      zacharie_carcasse_id: ZC,
      intermediaire_id: 'INT-1',
      intermediaire_entity_id: 'entity-A',
      intermediaire_role: 'ETG',
      intermediaire_user_id: 'user-int',
      is_synced: true,
    };
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce(savedCi as any);

    vi.mocked(prisma.fei.findMany).mockResolvedValue([baseFei as any]);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: FEI, date_mise_a_mort: '2026-01-01' }],
          carcasses: [{ fei_numero: FEI, zacharie_carcasse_id: ZC, numero_bracelet: 'BR-RT' }],
          carcassesIntermediaires: [
            {
              fei_numero: FEI,
              zacharie_carcasse_id: ZC,
              intermediaire_id: 'INT-1',
              intermediaire_entity_id: 'entity-A',
              intermediaire_role: 'ETG',
              intermediaire_user_id: 'user-int',
            },
          ],
        })
    );

    expect(res.status).toBe(200);

    expect(res.body.data.feis[0].numero).toBe(FEI);
    expect(res.body.data.carcasses[0].zacharie_carcasse_id).toBe(ZC);

    const ci = res.body.data.carcassesIntermediaires[0];
    expect(ci.fei_numero).toBe(FEI);
    expect(ci.zacharie_carcasse_id).toBe(ZC);
    expect(ci.intermediaire_id).toBe('INT-1');

    expect(res.body.data.carcasses[0].is_synced).toBe(true);
    expect(res.body.data.carcassesIntermediaires[0].is_synced).toBe(true);
  });

  test('two intermediaires for same (fei, carcasse), different intermediaire_id → distinct rows in response and distinct upsert keys', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue(baseFei as any);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue(baseCarcasse as any);
    vi.mocked(prisma.carcasseIntermediaire.upsert)
      .mockResolvedValueOnce({
        fei_numero: FEI,
        zacharie_carcasse_id: ZC,
        intermediaire_id: 'INT-A',
        intermediaire_entity_id: 'entity-A',
        intermediaire_role: 'ETG',
        intermediaire_user_id: 'user-1',
        is_synced: true,
      } as any)
      .mockResolvedValueOnce({
        fei_numero: FEI,
        zacharie_carcasse_id: ZC,
        intermediaire_id: 'INT-B',
        intermediaire_entity_id: 'entity-B',
        intermediaire_role: 'COLLECTEUR_PRO',
        intermediaire_user_id: 'user-2',
        is_synced: true,
      } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcassesIntermediaires: [
            {
              fei_numero: FEI,
              zacharie_carcasse_id: ZC,
              intermediaire_id: 'INT-A',
              intermediaire_entity_id: 'entity-A',
              intermediaire_role: 'ETG',
              intermediaire_user_id: 'user-1',
            },
            {
              fei_numero: FEI,
              zacharie_carcasse_id: ZC,
              intermediaire_id: 'INT-B',
              intermediaire_entity_id: 'entity-B',
              intermediaire_role: 'COLLECTEUR_PRO',
              intermediaire_user_id: 'user-2',
            },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.carcassesIntermediaires).toHaveLength(2);
    expect(res.body.data.carcassesIntermediaires.map((c: any) => c.intermediaire_id)).toEqual([
      'INT-A',
      'INT-B',
    ]);

    const upsertCalls = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls;
    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[0][0].where).toEqual({
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: FEI,
        zacharie_carcasse_id: ZC,
        intermediaire_id: 'INT-A',
      },
    });
    expect(upsertCalls[1][0].where).toEqual({
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: FEI,
        zacharie_carcasse_id: ZC,
        intermediaire_id: 'INT-B',
      },
    });
  });
});
