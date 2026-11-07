import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseStatus, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import fichePdfRouter from '~/controllers/fiche-pdf';
import { getFicheExtraitPdfBuffer } from '~/templates/get-fiche-extrait-pdf';

// GET /fiche-pdf/:fei_numero — extrait PDF de la fiche, pour le SVI et l'ETG uniquement, limité aux
// carcasses de leur périmètre de lecture (getCarcasseAccessWhere).

vi.mock('~/templates/get-fiche-extrait-pdf', () => ({
  getFicheExtraitPdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));

// vitest.setup.ts ne fournit pas carcasseIntermediaire.findMany — ajouté pour cette suite.
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

const sviUser = { id: 'user-svi', roles: [UserRoles.SVI], activated: true, isZacharieAdmin: false };
const etgUser = { id: 'user-etg', roles: [UserRoles.ETG], activated: true, isZacharieAdmin: false };
const chasseurUser = { id: 'user-chasseur', roles: [UserRoles.CHASSEUR], activated: true, isZacharieAdmin: false };
const collecteurUser = {
  id: 'user-coll',
  roles: [UserRoles.COLLECTEUR_PRO],
  activated: true,
  isZacharieAdmin: false,
};

const app = express();
app.use(express.json());
app.use('/fiche-pdf', fichePdfRouter);

const FEI = 'ZACH-2026-0001';
const ENTITY_IDS = ['entity-1'];

const sviAccessWhere: Prisma.CarcasseWhereInput = {
  svi_assigned_at: { not: null },
  OR: [{ svi_entity_id: { in: ENTITY_IDS } }, { next_owner_entity_id: { in: ENTITY_IDS } }],
};

const carcasse = {
  zacharie_carcasse_id: `${FEI}_001`,
  fei_numero: FEI,
  numero_bracelet: 'B-001',
  espece: 'Sanglier',
  nombre_d_animaux: 1,
  premier_detenteur_name_cache: 'Asso de chasse',
  svi_entity_id: 'entity-1',
  svi_carcasse_status: CarcasseStatus.REFUS_ETG_COLLECTEUR,
  intermediaire_carcasse_refus_motif: 'Souillure',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-1' } as any]);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findFirst).mockResolvedValue({
    numero: FEI,
    date_mise_a_mort: new Date('2026-10-01'),
    commune_mise_a_mort: 'Moulins',
    examinateur_initial_user_id: 'user-exam',
  } as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ prenom: 'Jean', nom_de_famille: 'Dupont' } as any);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([
    { id: 'entity-1', nom_d_usage: 'SVI 1' } as any,
    { id: 'entity-etg', nom_d_usage: 'ETG 1' } as any,
  ]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
    {
      intermediaire_id: 'inter-1',
      intermediaire_entity_id: 'entity-etg',
      intermediaire_role: FeiOwnerRole.ETG,
      prise_en_charge_at: new Date('2026-10-02'),
    },
  ]);
});

describe('Accès', () => {
  test('non connecté → 401', async () => {
    const res = await request(app).get(`/fiche-pdf/${FEI}`);
    expect(res.status).toBe(401);
  });

  test('compte non activé → 400', async () => {
    const res = await request(app)
      .get(`/fiche-pdf/${FEI}`)
      .set('x-test-user', JSON.stringify({ ...sviUser, activated: false }));
    expect(res.status).toBe(400);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test.each([
    ['chasseur', chasseurUser],
    ['collecteur', collecteurUser],
  ])('%s → 403, aucune lecture de carcasse', async (_label, user) => {
    const res = await request(app).get(`/fiche-pdf/${FEI}`).set('x-test-user', JSON.stringify(user));
    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('aucune carcasse de la fiche dans le périmètre → 404, pas de PDF', async () => {
    const res = await request(app).get(`/fiche-pdf/${FEI}`).set('x-test-user', JSON.stringify(etgUser));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Fiche introuvable');
    expect(getFicheExtraitPdfBuffer).not.toHaveBeenCalled();
  });
});

describe('Génération', () => {
  test('SVI → PDF limité aux carcasses de son périmètre', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);

    const res = await request(app).get(`/fiche-pdf/${FEI}`).set('x-test-user', JSON.stringify(sviUser));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="fiche-${FEI}.pdf"`);
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI, deleted_at: null, ...sviAccessWhere },
      orderBy: { numero_bracelet: 'asc' },
    });
    expect(getFicheExtraitPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        numero: FEI,
        examinateur: 'Jean Dupont',
        premierDetenteur: 'Asso de chasse',
        svi: 'SVI 1',
        intermediaires: [{ nom: 'ETG 1', role: 'ETG', priseEnChargeAt: new Date('2026-10-02') }],
        carcasses: [
          {
            numeroBracelet: 'B-001',
            espece: 'Sanglier',
            nombreAnimaux: 1,
            statut: "Refusée par l'intermédiaire : Souillure",
          },
        ],
      })
    );
  });

  test('ETG → 200', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);
    const res = await request(app).get(`/fiche-pdf/${FEI}`).set('x-test-user', JSON.stringify(etgUser));
    expect(res.status).toBe(200);
  });
});
