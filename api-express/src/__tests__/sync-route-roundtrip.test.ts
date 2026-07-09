import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import syncRouter from '~/controllers/sync';
import prisma from '~/prisma';
import { Carcasse, Fei, UserRoles } from '@prisma/client';

// Integration test for POST /sync. Unlike sync-route.test.ts which mocks
// syncFei / syncCarcasse / syncCarcasseIntermediaire to pin routing behavior,
// this file exercises those three utils end-to-end against mocked prisma.
// It pins the response-shape contract that the client's syncData() depends
// on for store hydration: the client wholesale-replaces local Zustand
// entries with res.data, keyed by fei.numero, carcasse.zacharie_carcasse_id,
// and the (fei_numero, zacharie_carcasse_id, intermediaire_id) composite for
// intermediaires. If any of those identity fields go missing from the
// response, the client silently drops the record.
//
// Replaces the deleted
// app-local-first-react-router/__tests__/carcasse-load-and-merge.test.ts:
// last-write-wins-by-updated_at merge logic moved server-side, but the
// composite-id keying and per-entity identity invariants the old test
// guarded are still load-bearing for offline-edit safety.

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
});

describe('POST /sync — round-trip (real utils against mocked prisma)', () => {
  test('fresh FEI + carcasse + intermediaire → response keys match client store hydration', async () => {
    // syncFei: no existing → create. Subsequent findUnique calls (carcasse + intermediaire
    // utils both look up the parent FEI) return the saved row.
    vi.mocked(prisma.fei.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(baseFei as any);
    vi.mocked(prisma.fei.create).mockResolvedValueOnce(baseFei as any);

    // syncCarcasse ne requête plus la carcasse : le batch d'existence (carcasse.findMany) renvoie
    // vide → chemin create, puis update applique les champs hasOwnProperty.
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
    // carcasse.findFirst reste mocké pour la recherche de la carcasse parente par syncCarcasseIntermediaire.
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue(baseCarcasse as any);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(baseCarcasse as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse as any);

    // syncCarcasseIntermediaire: upsert returns the saved row.
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

    // fei.findMany sert deux fois : pré-chargement des fiches des carcasses, puis re-fetch peuplé.
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

    // Every section must come back with the field the client uses as its store key
    // (see app-local-first-react-router/src/zustand/store.ts syncData merge).
    expect(res.body.data.feis[0].numero).toBe(FEI);
    expect(res.body.data.carcasses[0].zacharie_carcasse_id).toBe(ZC);

    // Client recomputes the composite id from these three — all three must round-trip.
    const ci = res.body.data.carcassesIntermediaires[0];
    expect(ci.fei_numero).toBe(FEI);
    expect(ci.zacharie_carcasse_id).toBe(ZC);
    expect(ci.intermediaire_id).toBe('INT-1');

    // is_synced=true on the response is how the client clears its dirty flag after wholesale replace.
    expect(res.body.data.carcasses[0].is_synced).toBe(true);
    expect(res.body.data.carcassesIntermediaires[0].is_synced).toBe(true);
  });

  test('two intermediaires for same (fei, carcasse), different intermediaire_id → distinct rows in response and distinct upsert keys', async () => {
    // The old client-side setFeiInStore guarded this with a composite-id map.
    // Server side, the same invariant lives in the upsert `where` clause.
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

    // Pin the upsert composite key — what makes the two rows distinct on the server side.
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
