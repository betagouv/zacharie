import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { applyPoolResult } from '~/utils/trichine-result';

// Un pool parti en confirmation au LNR : son résultat appartient au LNR, le LVD ne peut plus
// ni le corriger ni le refuser.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/utils/trichine-result', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-result')>()),
  applyPoolResult: vi.fn().mockResolvedValue({ kind: 'ok', pool: null, ftpConfirmation: null }),
}));
vi.mock('~/utils/trichine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine')>()),
  logTrichineStatutChange: vi.fn(),
  getFtpEmitterUsers: vi.fn().mockResolvedValue([]),
  notifyTrichineUsers: vi.fn(),
}));
vi.mock('~/utils/trichine-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-status')>()),
  recomputePoolAndLinkedFTPs: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/laboratoire', laboratoireRouter);

const laboUser = { id: 'user-labo', roles: [UserRoles.LABORATOIRE], activated: true, isZacharieAdmin: false };

const lien = (
  id: string,
  destinataire: string,
  isLnr: boolean,
  statut: TrichineStatutLogistiqueFTP = TrichineStatutLogistiqueFTP.RECUE
) => ({
  TrichineFTP: {
    id,
    numero_fiche: `F-26-${id}`,
    deleted_at: null as Date | null,
    statut_logistique: statut,
    destinataire_entity_id: destinataire,
    expediteur_user_id: 'user-emetteur',
    expediteur_entity_id: null as string | null,
    ftp_parent_id: null as string | null,
    DestinataireEntity: { id: destinataire, is_lnr: isLnr },
  },
});

const lienLvd = lien('ftp-lvd', 'lvd-1', false);
const lienLnr = lien('ftp-lnr', 'lnr-1', true);

const pool = (resultat: TrichineResultatAnalyse, liens: Array<ReturnType<typeof lien>>) => ({
  id: 'pool-1',
  reference_pool: 'P-26-SVI01-0045',
  resultat_analyse: resultat,
  parasite_identifie: null as string | null,
  raison_refus: null as string | null,
  refus_par_user_id: null as string | null,
  deleted_at: null as Date | null,
  TrichineEchantillons: [] as Array<never>,
  TrichinePoolFTPs: liens,
});

const connecterLabo = (entityId: string, isLnr: boolean) =>
  vi
    .mocked(prisma.entityAndUserRelations.findMany)
    .mockResolvedValue([{ EntityRelatedWithUser: { id: entityId, is_lnr: isLnr } }] as never);

const corriger = (resultat_analyse: TrichineResultatAnalyse) =>
  request(app)
    .post('/laboratoire/pool/pool-1/corriger-resultat')
    .set('x-test-user', JSON.stringify(laboUser))
    .send({ resultat_analyse, raison: 'Erreur de saisie' });

const refuser = () =>
  request(app)
    .post('/laboratoire/pool/pool-1/refuser')
    .set('x-test-user', JSON.stringify(laboUser))
    .send({ raison_refus: 'Échantillon abîmé' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyPoolResult).mockResolvedValue({ kind: 'ok', pool: null, ftpConfirmation: null } as never);
});

describe('POST /laboratoire/pool/:pool_id/corriger-resultat', () => {
  test('un LVD ne peut pas corriger le résultat rendu par le LNR', async () => {
    connecterLabo('lvd-1', false);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.POSITIF, [lienLnr, lienLvd]) as never
    );

    const response = await corriger(TrichineResultatAnalyse.NEGATIF);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/seul le LNR peut modifier son résultat/);
    expect(prisma.trichinePool.update).not.toHaveBeenCalled();
    expect(applyPoolResult).not.toHaveBeenCalled();
  });

  test('le LNR peut corriger son propre résultat', async () => {
    connecterLabo('lnr-1', true);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.POSITIF, [lienLnr, lienLvd]) as never
    );

    const response = await corriger(TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE);

    expect(response.status).toBe(200);
    expect(applyPoolResult).toHaveBeenCalledWith(expect.objectContaining({ isLnr: true }));
  });

  test('un LVD peut corriger un résultat négatif jamais transmis au LNR', async () => {
    connecterLabo('lvd-1', false);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.NEGATIF, [lienLvd]) as never
    );

    const response = await corriger(TrichineResultatAnalyse.DOUTEUX);

    expect(response.status).toBe(200);
    expect(applyPoolResult).toHaveBeenCalledWith(expect.objectContaining({ isLnr: false }));
  });

  test('une fiche de confirmation annulée ne bloque pas la correction par le LVD', async () => {
    connecterLabo('lvd-1', false);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.NEGATIF, [
        lien('ftp-lnr', 'lnr-1', true, TrichineStatutLogistiqueFTP.ANNULEE),
        lienLvd,
      ]) as never
    );

    const response = await corriger(TrichineResultatAnalyse.DOUTEUX);

    expect(response.status).toBe(200);
  });
});

describe('POST /laboratoire/pool/:pool_id/refuser', () => {
  test('un LVD ne peut pas refuser un pool douteux parti en confirmation au LNR', async () => {
    connecterLabo('lvd-1', false);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.DOUTEUX, [lienLnr, lienLvd]) as never
    );

    const response = await refuser();

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/seul le LNR peut modifier son résultat/);
    expect(prisma.trichinePool.update).not.toHaveBeenCalled();
  });

  test('le LNR peut refuser un pool douteux qu’il a reçu', async () => {
    connecterLabo('lnr-1', true);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool(TrichineResultatAnalyse.DOUTEUX, [lienLnr, lienLvd]) as never
    );

    const response = await refuser();

    expect(response.status).toBe(200);
    expect(prisma.trichinePool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultat_analyse: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE }),
      })
    );
  });
});
