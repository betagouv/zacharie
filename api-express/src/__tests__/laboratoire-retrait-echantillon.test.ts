import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { notifyTrichineUsers } from '~/utils/trichine';
import { dernierEchantillonRetireParLabo, recomputeEchantillonTrichine } from '~/utils/trichine-status';

// POST /laboratoire/echantillon/:id/retirer-du-pool — le laboratoire (LVD ou LNR) sort un
// échantillon de son pool, à réception ou en cours d'analyse, tant qu'il n'a pas rendu le résultat.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/utils/trichine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine')>()),
  logTrichineStatutChange: vi.fn(),
  getFtpEmitterUsers: vi.fn().mockResolvedValue([]),
  notifyTrichineUsers: vi.fn(),
}));
vi.mock('~/utils/trichine-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-status')>()),
  recomputePoolAndLinkedFTPs: vi.fn(),
  recomputeEchantillonTrichine: vi.fn(),
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

const pool = ({
  resultat = null,
  liens = [lien('ftp-lvd', 'lvd-1', false)],
  echantillons = 3,
}: {
  resultat?: TrichineResultatAnalyse | null;
  liens?: Array<ReturnType<typeof lien>>;
  echantillons?: number;
} = {}) => ({
  id: 'pool-1',
  reference_pool: 'P-26-SVI01-0045',
  statut: 'EN_COURS_ANALYSES',
  resultat_analyse: resultat,
  deleted_at: null as Date | null,
  TrichineEchantillons: Array.from({ length: echantillons }, (_, index) => ({ id: `ech-${index}` })),
  TrichinePoolFTPs: liens,
});

const connecterLabo = (entityId: string, isLnr: boolean) =>
  vi
    .mocked(prisma.entityAndUserRelations.findMany)
    .mockResolvedValue([{ EntityRelatedWithUser: { id: entityId, is_lnr: isLnr } }] as never);

const retirer = (motif = 'Tube absent du colis') =>
  request(app)
    .post('/laboratoire/echantillon/ech-0/retirer-du-pool')
    .set('x-test-user', JSON.stringify(laboUser))
    .send({ motif });

beforeEach(() => {
  vi.clearAllMocks();
  connecterLabo('lvd-1', false);
  vi.mocked(prisma.trichineEchantillon.findUnique).mockResolvedValue({
    id: 'ech-0',
    reference_echantillon: 'E-26-SVI01-0001',
    zacharie_carcasse_id: 'ZC-1',
    statut: 'EN_COURS_ANALYSES',
    pool_id: 'pool-1',
    deleted_at: null,
  } as never);
  vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool() as never);
  vi.mocked(prisma.trichineEchantillon.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.carcasse.findUnique).mockResolvedValue({ numero_bracelet: 'BR-1' } as never);
});

describe('POST /laboratoire/echantillon/:id/retirer-du-pool', () => {
  test('LVD : sort l’échantillon du pool, trace le retrait et notifie l’émetteur', async () => {
    const response = await retirer();
    expect(response.status).toBe(200);
    const update = vi.mocked(prisma.trichineEchantillon.updateMany).mock.calls[0][0];
    expect(update.where).toEqual({ id: 'ech-0', pool_id: 'pool-1' });
    expect(update.data).toMatchObject({
      pool_id: null,
      retire_du_pool_id: 'pool-1',
      retire_par_labo_motif: 'Tube absent du colis',
      retire_par_labo_user_id: 'user-labo',
    });
    expect(recomputeEchantillonTrichine).toHaveBeenCalledWith('ech-0', 'user-labo');
    expect(notifyTrichineUsers).toHaveBeenCalledTimes(1);
  });

  test('motif obligatoire', async () => {
    const response = await retirer('   ');
    expect(response.status).toBe(400);
    expect(prisma.trichineEchantillon.updateMany).not.toHaveBeenCalled();
  });

  test('colis pas encore réceptionné → refus', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool({ liens: [lien('ftp-lvd', 'lvd-1', false, TrichineStatutLogistiqueFTP.ENVOYEE)] }) as never
    );
    const response = await retirer();
    expect(response.status).toBe(400);
    expect(prisma.trichineEchantillon.updateMany).not.toHaveBeenCalled();
  });

  test('résultat déjà saisi par le LVD → refus', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool({ resultat: TrichineResultatAnalyse.NEGATIF }) as never
    );
    const response = await retirer();
    expect(response.status).toBe(400);
    expect(prisma.trichineEchantillon.updateMany).not.toHaveBeenCalled();
  });

  test('pool douteux transmis au LNR → le LVD ne peut plus retirer', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool({
        resultat: TrichineResultatAnalyse.DOUTEUX,
        liens: [lien('ftp-lnr', 'lnr-1', true), lien('ftp-lvd', 'lvd-1', false)],
      }) as never
    );
    const response = await retirer();
    expect(response.status).toBe(400);
    expect(prisma.trichineEchantillon.updateMany).not.toHaveBeenCalled();
  });

  test('LNR : retire d’un pool douteux tant qu’il n’a pas confirmé', async () => {
    connecterLabo('lnr-1', true);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool({
        resultat: TrichineResultatAnalyse.DOUTEUX,
        liens: [lien('ftp-lnr', 'lnr-1', true), lien('ftp-lvd', 'lvd-1', false)],
      }) as never
    );
    const response = await retirer();
    expect(response.status).toBe(200);
  });

  test('LNR : confirmation rendue → refus', async () => {
    connecterLabo('lnr-1', true);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(
      pool({
        resultat: TrichineResultatAnalyse.POSITIF,
        liens: [lien('ftp-lnr', 'lnr-1', true), lien('ftp-lvd', 'lvd-1', false)],
      }) as never
    );
    const response = await retirer();
    expect(response.status).toBe(400);
  });

  test('dernier échantillon du pool → refuser le pool à la place', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool({ echantillons: 1 }) as never);
    const response = await retirer();
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/refusez plutôt le pool/);
  });

  test('laboratoire étranger au pool → 404', async () => {
    connecterLabo('lvd-autre', false);
    const response = await retirer();
    expect(response.status).toBe(404);
  });

  test('retrait concurrent déjà appliqué → refus sans notification', async () => {
    vi.mocked(prisma.trichineEchantillon.updateMany).mockResolvedValue({ count: 0 });
    const response = await retirer();
    expect(response.status).toBe(400);
    expect(notifyTrichineUsers).not.toHaveBeenCalled();
  });
});

describe('dernierEchantillonRetireParLabo', () => {
  const ech = (jour: number, retire: boolean) => ({
    created_at: new Date(2026, 9, jour),
    retire_par_labo_at: retire ? new Date(2026, 9, jour + 1) : null,
  });

  test('aucun échantillon → false', () => {
    expect(dernierEchantillonRetireParLabo([])).toBe(false);
  });

  test('dernier prélèvement retiré → carcasse à re-prélever', () => {
    expect(dernierEchantillonRetireParLabo([ech(1, false), ech(5, true)])).toBe(true);
  });

  test('re-prélevée après le retrait → plus d’action liée au retrait', () => {
    expect(dernierEchantillonRetireParLabo([ech(1, true), ech(5, false)])).toBe(false);
  });
});
