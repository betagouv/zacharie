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
vi.mock('~/utils/sync-carcasse-modification-request', () => ({
  syncCarcasseModifRequest: vi.fn(),
  runCarcasseModifRequestSideEffects: vi.fn().mockResolvedValue(undefined),
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

// Ce fichier teste le routage et l'isolation des erreurs, pas l'autorisation : le périmètre est
// neutralisé pour qu'il n'ajoute pas de requête carcasse.findMany dans les séquences mockées ici.
const { permissiveScope } = vi.hoisted(() => ({
  permissiveScope: {
    entityIds: ['entity-etg', 'entity-collecteur', 'entity-svi'],
    prefetch: async () => {},
    canWriteCarcasse: async () => true,
    grant: () => {},
    isFeiOwner: () => true,
    canWriteFei: async () => true,
  },
}));
vi.mock('~/utils/sync-scope', () => ({ createSyncScope: vi.fn(async () => permissiveScope) }));

import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import {
  syncCarcasseModifRequest,
  runCarcasseModifRequestSideEffects,
} from '~/utils/sync-carcasse-modification-request';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';
import { CarcasseModificationRequestStatus } from '@prisma/client';
import { SyncRejectedError } from '~/utils/sync-errors';

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
  test('batch-inserts all logs and returns synced ids', async () => {
    vi.mocked(prisma.log.createMany).mockResolvedValue({ count: 2 } as any);

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
    expect(prisma.log.createMany).toHaveBeenCalledOnce();
    expect(res.body.data.syncedLogIds).toEqual(['L1', 'L2']);
  });

  test('a failing log batch is captured and yields no synced ids', async () => {
    vi.mocked(prisma.log.createMany).mockRejectedValueOnce(new Error('log-batch-failed'));

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
    expect(res.body.data.syncedLogIds).toEqual([]);
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
        carcasseModifRequests: [],
        syncedLogIds: [],
        rejected: [],
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

describe('POST /sync — refus définitifs vs erreurs transitoires', () => {
  // La distinction est le cœur du mécanisme : sur un refus le client jette sa version locale, donc
  // une erreur technique classée à tort en refus détruirait le travail de l'utilisateur.
  test("un refus d'autorisation est renvoyé dans `rejected`, pas capturé comme une erreur", async () => {
    vi.mocked(syncCarcasse).mockRejectedValueOnce(
      new SyncRejectedError("Vous n'avez pas accès à cette carcasse")
    );

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'FEI-1', zacharie_carcasse_id: 'ZC-INTERDITE' }],
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toEqual([
      { kind: 'carcasse', id: 'ZC-INTERDITE', reason: "Vous n'avez pas accès à cette carcasse" },
    ]);
    expect(res.body.data.carcasses).toEqual([]);
  });

  test('une erreur transitoire reste capturée et absente de `rejected` — le client réessaiera', async () => {
    vi.mocked(syncCarcasse).mockRejectedValueOnce(new Error('Fiche non trouvée'));

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'FEI-1', zacharie_carcasse_id: 'ZC-1' }],
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toEqual([]);
    expect(capture).toHaveBeenCalled();
  });

  test("les refus remontent à l'équipe en un seul évènement Sentry groupable", async () => {
    vi.mocked(syncFei).mockRejectedValueOnce(new SyncRejectedError("Vous n'avez pas accès à cette fiche"));
    vi.mocked(syncCarcasse).mockRejectedValueOnce(
      new SyncRejectedError("Vous n'avez pas accès à cette carcasse")
    );

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'FEI-INTERDITE' }],
          carcasses: [{ fei_numero: 'FEI-1', zacharie_carcasse_id: 'ZC-INTERDITE' }],
        })
    );

    expect(res.body.data.rejected).toHaveLength(2);
    const captureCalls = vi.mocked(capture).mock.calls;
    expect(captureCalls).toHaveLength(1);
    expect((captureCalls[0][0] as Error).message).toBe('Écritures /sync refusées');
    expect(captureCalls[0][1]?.extra).toMatchObject({ count: 2 });
  });

  // Un refus ne laisse rien en base et le client cesse de pousser l'item : sans son payload dans
  // l'évènement, la saisie de l'utilisateur n'est plus récupérable nulle part.
  test("l'évènement de refus porte le payload de chaque item refusé", async () => {
    vi.mocked(syncCarcasse).mockRejectedValueOnce(
      new SyncRejectedError("Vous n'avez pas accès à cette carcasse")
    );
    const carcasseRefusee = {
      fei_numero: 'FEI-1',
      zacharie_carcasse_id: 'ZC-INTERDITE',
      heure_evisceration: '23:59',
    };

    await authed(
      request(app)
        .post('/sync')
        .send({ carcasses: [carcasseRefusee] })
    );

    const extra = vi.mocked(capture).mock.calls[0][1]?.extra;
    expect(extra.rejectedBodies).toEqual([{ kind: 'carcasse', id: 'ZC-INTERDITE', body: carcasseRefusee }]);
    expect(extra.bodiesTruncated).toBe(false);
  });

  test('un lot massivement refusé garde les 20 premiers payloads et signale la troncature', async () => {
    const carcasses = Array.from({ length: 25 }, (_, i) => ({
      fei_numero: 'FEI-1',
      zacharie_carcasse_id: `ZC-${i}`,
    }));
    vi.mocked(syncCarcasse).mockRejectedValue(
      new SyncRejectedError("Vous n'avez pas accès à cette carcasse")
    );

    const res = await authed(request(app).post('/sync').send({ carcasses }));

    expect(res.body.data.rejected).toHaveLength(25);
    const extra = vi.mocked(capture).mock.calls[0][1]?.extra;
    expect(extra.rejectedBodies).toHaveLength(20);
    expect(extra.bodiesTruncated).toBe(true);
    // Le compte reste exact : c'est lui qui dit combien de payloads manquent.
    expect(extra.count).toBe(25);
  });

  test('un refus sur une carcasse ne bloque pas les autres items du lot', async () => {
    vi.mocked(syncCarcasse)
      .mockRejectedValueOnce(new SyncRejectedError("Vous n'avez pas accès à cette carcasse"))
      .mockResolvedValueOnce({
        savedCarcasse: { zacharie_carcasse_id: 'ZC-OK' },
        existingCarcasse: { zacharie_carcasse_id: 'ZC-OK' },
        isDeleted: false,
      } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [
            { fei_numero: 'FEI-1', zacharie_carcasse_id: 'ZC-INTERDITE' },
            { fei_numero: 'FEI-1', zacharie_carcasse_id: 'ZC-OK' },
          ],
        })
    );

    expect(res.body.data.rejected).toHaveLength(1);
    expect(res.body.data.carcasses).toHaveLength(1);
  });
});

describe('POST /sync — carcasse modification requests', () => {
  test('modifRequests processed after carcasses (step 4 in the pipeline)', async () => {
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
    vi.mocked(syncCarcasseModifRequest).mockImplementation(async (body: any) => {
      callOrder.push(`modif:${body.id}`);
      return { saved: body, isNew: true, transitionedTo: null, justCancelled: false };
    });

    await authed(
      request(app)
        .post('/sync')
        .send({
          feis: [{ numero: 'F1' }],
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C1' }],
          carcassesIntermediaires: [{ fei_numero: 'F1', intermediaire_id: 'I1', zacharie_carcasse_id: 'C1' }],
          carcasseModifRequests: [{ id: 'M1', zacharie_carcasse_id: 'C1', fei_numero: 'F1' }],
          logs: [],
        })
    );

    expect(callOrder).toEqual(['fei:F1', 'carcasse:C1', 'ci:C1:I1', 'modif:M1']);
  });

  test('saved modifRequests included in response', async () => {
    vi.mocked(syncCarcasseModifRequest).mockResolvedValue({
      saved: { id: 'M1', status: 'PENDING' } as any,
      isNew: true,
      transitionedTo: null,
      justCancelled: false,
    });

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasseModifRequests: [{ id: 'M1', zacharie_carcasse_id: 'C1', fei_numero: 'F1' }],
        })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.carcasseModifRequests).toEqual([{ id: 'M1', status: 'PENDING' }]);
  });

  test('side effects run after persistence; receives the approvalPayload from _approvalPayload', async () => {
    vi.mocked(syncCarcasseModifRequest).mockResolvedValue({
      saved: { id: 'M1', status: 'APPROVED', zacharie_carcasse_id: 'C1' } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.APPROVED,
      justCancelled: false,
    });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([]);

    const approvalPayload = {
      examinateur_anomalies_carcasse: ['hématome'],
      examinateur_approbation_mise_sur_le_marche: true,
    };
    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasseModifRequests: [
            {
              id: 'M1',
              zacharie_carcasse_id: 'C1',
              fei_numero: 'F1',
              status: 'APPROVED',
              _approvalPayload: approvalPayload,
            },
          ],
        })
    );

    expect(runCarcasseModifRequestSideEffects).toHaveBeenCalledOnce();
    const args = vi.mocked(runCarcasseModifRequestSideEffects).mock.calls[0];
    expect(args[0].transitionedTo).toBe(CarcasseModificationRequestStatus.APPROVED);
    expect(args[1]).toEqual(approvalPayload);
  });

  test('_approvalPayload is stripped from the persisted body sent to syncCarcasseModifRequest', async () => {
    vi.mocked(syncCarcasseModifRequest).mockResolvedValue({
      saved: { id: 'M1' } as any,
      isNew: true,
      transitionedTo: null,
      justCancelled: false,
    });

    await authed(
      request(app)
        .post('/sync')
        .send({
          carcasseModifRequests: [
            {
              id: 'M1',
              zacharie_carcasse_id: 'C1',
              fei_numero: 'F1',
              _approvalPayload: { examinateur_commentaire: 'should not be persisted' },
            },
          ],
        })
    );

    const passed = vi.mocked(syncCarcasseModifRequest).mock.calls[0][0];
    expect('_approvalPayload' in passed).toBe(false);
  });

  test('transitioned carcasses are refetched and merged into the response', async () => {
    vi.mocked(syncCarcasse).mockResolvedValueOnce({
      savedCarcasse: { zacharie_carcasse_id: 'C1', numero_bracelet: 'OLD' } as any,
      existingCarcasse: { zacharie_carcasse_id: 'C1', numero_bracelet: 'OLD' } as any,
      isDeleted: false,
    });
    vi.mocked(syncCarcasseModifRequest).mockResolvedValue({
      saved: { id: 'M1', zacharie_carcasse_id: 'C1' } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.APPROVED,
      justCancelled: false,
    });
    // carcasse.findMany sert deux fois : pré-chargement d'existence (batch), puis refresh
    // post-side-effects qui renvoie la carcasse renommée.
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([{ zacharie_carcasse_id: 'C1', numero_bracelet: 'OLD' } as any])
      .mockResolvedValueOnce([{ zacharie_carcasse_id: 'C1', numero_bracelet: 'NEW' } as any]);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasses: [{ fei_numero: 'F1', zacharie_carcasse_id: 'C1' }],
          carcasseModifRequests: [
            { id: 'M1', zacharie_carcasse_id: 'C1', fei_numero: 'F1', status: 'APPROVED' },
          ],
        })
    );

    expect(res.status).toBe(200);
    // The refreshed (post-side-effect) carcasse overrides the earlier saved one.
    expect(res.body.data.carcasses).toEqual([{ zacharie_carcasse_id: 'C1', numero_bracelet: 'NEW' }]);
  });

  test('justCancelled modif also triggers a carcasse refresh', async () => {
    vi.mocked(syncCarcasseModifRequest).mockResolvedValue({
      saved: { id: 'M1', zacharie_carcasse_id: 'C1' } as any,
      isNew: false,
      transitionedTo: null,
      justCancelled: true,
    });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      { zacharie_carcasse_id: 'C1', deleted_at: new Date() } as any,
    ]);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasseModifRequests: [
            { id: 'M1', zacharie_carcasse_id: 'C1', fei_numero: 'F1', deleted_at: new Date() },
          ],
        })
    );

    expect(prisma.carcasse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zacharie_carcasse_id: { in: ['C1'] } } })
    );
    expect(res.body.data.carcasses[0].deleted_at).toBeTruthy();
  });

  test('a failing modifRequest is captured but does not block other requests or logs', async () => {
    vi.mocked(syncCarcasseModifRequest).mockImplementation(async (body: any) => {
      if (body.id === 'M-BAD') throw new Error('modif-failed');
      return {
        saved: body,
        isNew: true,
        transitionedTo: null,
        justCancelled: false,
      };
    });
    vi.mocked(prisma.log.createMany).mockResolvedValue({ count: 1 } as any);

    const res = await authed(
      request(app)
        .post('/sync')
        .send({
          carcasseModifRequests: [
            { id: 'M-BAD', zacharie_carcasse_id: 'C1', fei_numero: 'F1' },
            { id: 'M-OK', zacharie_carcasse_id: 'C1', fei_numero: 'F1' },
          ],
          logs: [
            {
              id: 'L1',
              user_id: 'u1',
              user_role: 'CHASSEUR',
              action: 'log-action',
            },
          ],
        })
    );

    expect(res.status).toBe(200);
    expect(capture).toHaveBeenCalled();
    // Both M-BAD attempt and M-OK get tried.
    expect(syncCarcasseModifRequest).toHaveBeenCalledTimes(2);
    // Subsequent log step still runs.
    expect(prisma.log.createMany).toHaveBeenCalledOnce();
    // Response carries the successful one.
    expect(res.body.data.carcasseModifRequests.map((r: any) => r.id)).toEqual(['M-OK']);
  });
});
