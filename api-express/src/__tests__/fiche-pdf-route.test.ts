import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseStatus, CarcasseType, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import fichePdfRouter, {
  MAX_CARCASSES_FICHE_PDF,
  LONGUEUR_MAX_TEXTE_FICHE_PDF,
} from '~/controllers/fiche-pdf';
import { getFicheExtraitPdfBuffer } from '~/templates/get-fiche-extrait-pdf';

// GET /fiche-pdf/:fei_numero/:premier_detenteur_prochain_detenteur_id_cache — extrait PDF d'une transmission
// de la fiche, pour le SVI et l'ETG uniquement : les carcasses de leur périmètre de lecture
// (getCarcasseAccessWhere), plus celles refusées ou manquantes chez un intermédiaire, comme sur la page.

vi.mock('~/templates/get-fiche-extrait-pdf', () => ({
  getFicheExtraitPdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));

// vitest.setup.ts ne fournit pas carcasseIntermediaire.findMany — ajouté pour cette suite.
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

const sviUser = { id: 'user-svi', roles: [UserRoles.SVI], activated: true, isZacharieAdmin: false };
const etgUser = { id: 'user-etg', roles: [UserRoles.ETG], activated: true, isZacharieAdmin: false };
const chasseurUser = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};
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
const TRANSMISSION = 'entity-etg';
const URL = `/fiche-pdf/${FEI}/${TRANSMISSION}`;
const ENTITY_IDS = ['entity-1'];

const sviAccessWhere: Prisma.CarcasseWhereInput = {
  svi_assigned_at: { not: null },
  OR: [{ svi_entity_id: { in: ENTITY_IDS } }, { next_owner_entity_id: { in: ENTITY_IDS } }],
};

const transmissionWhere = {
  fei_numero: FEI,
  premier_detenteur_prochain_detenteur_id_cache: TRANSMISSION,
  deleted_at: null as Date | null,
};

const carcasse = {
  zacharie_carcasse_id: `${FEI}_001`,
  fei_numero: FEI,
  numero_bracelet: 'B-001',
  type: CarcasseType.GROS_GIBIER,
  espece: 'Sanglier',
  nombre_d_animaux: 1,
  premier_detenteur_name_cache: 'Asso de chasse',
  svi_entity_id: 'entity-1',
  svi_carcasse_status: CarcasseStatus.REFUS_ETG_COLLECTEUR,
  svi_carcasse_status_set_at: new Date('2026-10-02'),
  intermediaire_carcasse_refus_motif: 'Souillure',
};

const ciEtg = {
  intermediaire_id: 'inter-1',
  zacharie_carcasse_id: `${FEI}_001`,
  intermediaire_entity_id: 'entity-etg',
  intermediaire_role: FeiOwnerRole.ETG,
  prise_en_charge_at: new Date('2026-10-02'),
  decision_at: new Date('2026-10-02'),
  nombre_d_animaux_acceptes: null as number | null,
};

function pdfData() {
  return vi.mocked(getFicheExtraitPdfBuffer).mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-1' } as any]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(1);
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
    { id: 'entity-coll', nom_d_usage: 'Collecteur 1' } as any,
  ]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([ciEtg]);
});

describe('Accès', () => {
  test('non connecté → 401', async () => {
    const res = await request(app).get(URL);
    expect(res.status).toBe(401);
  });

  test('compte non activé → 400', async () => {
    const res = await request(app)
      .get(URL)
      .set('x-test-user', JSON.stringify({ ...sviUser, activated: false }));
    expect(res.status).toBe(400);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test.each([
    ['chasseur', chasseurUser],
    ['collecteur', collecteurUser],
  ])('%s → 403, aucune lecture de carcasse', async (_label, user) => {
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(user));
    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('aucune carcasse de la transmission dans le périmètre → 404, même si des carcasses refusées existent', async () => {
    vi.mocked(prisma.carcasse.count).mockResolvedValue(0);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(sviUser));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Fiche introuvable');
    expect(prisma.carcasse.count).toHaveBeenCalledWith({
      where: { ...transmissionWhere, ...sviAccessWhere },
    });
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
    expect(getFicheExtraitPdfBuffer).not.toHaveBeenCalled();
  });

  test('fiche supprimée → 404', async () => {
    vi.mocked(prisma.fei.findFirst).mockResolvedValue(null);
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(res.status).toBe(404);
    expect(prisma.fei.findFirst).toHaveBeenCalledWith({ where: { numero: FEI, deleted_at: null } });
  });
});

describe('Carcasses reprises', () => {
  test('périmètre de lecture + carcasses refusées ou manquantes de la transmission, comme sur la page', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(sviUser));
    expect(res.status).toBe(200);
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith({
      where: {
        ...transmissionWhere,
        OR: [
          sviAccessWhere,
          { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
          { intermediaire_carcasse_manquante: true },
        ],
      },
      orderBy: { numero_bracelet: 'asc' },
      take: MAX_CARCASSES_FICHE_PDF + 1,
    });
    expect((prisma.carcasseIntermediaire as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { zacharie_carcasse_id: { in: [`${FEI}_001`] }, deleted_at: null },
      })
    );
  });

  test(`plus de ${MAX_CARCASSES_FICHE_PDF} carcasses → 413, pas de rendu`, async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue(
      Array.from(
        { length: MAX_CARCASSES_FICHE_PDF + 1 },
        (_, i) => ({ ...carcasse, numero_bracelet: `B-${i}` }) as any
      )
    );
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(res.status).toBe(413);
    expect(res.body.error).toContain(`${MAX_CARCASSES_FICHE_PDF} carcasses`);
    expect(getFicheExtraitPdfBuffer).not.toHaveBeenCalled();
  });

  test(`exactement ${MAX_CARCASSES_FICHE_PDF} carcasses → 200`, async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue(
      Array.from(
        { length: MAX_CARCASSES_FICHE_PDF },
        (_, i) => ({ ...carcasse, numero_bracelet: `B-${i}` }) as any
      )
    );
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(res.status).toBe(200);
  });
});

describe('Contenu du PDF', () => {
  test('textes longs (saisis sans limite) tronqués, pour borner la durée du rendu', async () => {
    const long = 'x'.repeat(500);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        numero_bracelet: long,
        espece: long,
        premier_detenteur_name_cache: long,
        intermediaire_carcasse_refus_motif: long,
      } as any,
    ]);
    vi.mocked(prisma.fei.findFirst).mockResolvedValue({
      numero: long,
      commune_mise_a_mort: long,
      examinateur_initial_user_id: 'user-exam',
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ prenom: long, nom_de_famille: long } as any);
    vi.mocked(prisma.entity.findMany).mockResolvedValue([
      { id: 'entity-1', nom_d_usage: long } as any,
      { id: 'entity-etg', nom_d_usage: long } as any,
    ]);
    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(sviUser));
    expect(res.status).toBe(200);
    const tronque = `${'x'.repeat(LONGUEUR_MAX_TEXTE_FICHE_PDF - 1)}…`;
    const data = pdfData();
    expect([
      data.numero,
      data.communeMiseAMort,
      data.examinateur,
      data.premierDetenteur,
      data.svi,
      data.intermediaires[0].nom,
      data.carcasses[0].numeroBracelet,
      data.carcasses[0].espece,
    ]).toEqual(Array(8).fill(tronque));
    expect(data.carcasses[0].statut).toBe(`Refusée par ${tronque} : ${tronque}`);
  });

  test('SVI → données de chasse, traçabilité et carcasses', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);

    const res = await request(app).get(URL).set('x-test-user', JSON.stringify(sviUser));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="fiche-${FEI}.pdf"`);
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
            nombreAnimaux: '1',
            statut: 'Refusée par ETG 1 : Souillure',
          },
        ],
      })
    );
  });

  test('traçabilité : un intermédiaire par passage, dans l’ordre de création, collecteur libellé « Collecteur »', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      carcasse as any,
      { ...carcasse, zacharie_carcasse_id: `${FEI}_002`, numero_bracelet: 'B-002' } as any,
    ]);
    const ciColl = {
      ...ciEtg,
      intermediaire_id: 'inter-coll',
      intermediaire_entity_id: 'entity-coll',
      intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
      prise_en_charge_at: new Date('2026-10-03'),
    };
    // le collecteur est passé avant l'ETG (ordre de création), même si l'ETG a saisi une date de prise
    // en charge antérieure : c'est l'ordre de passage qui compte, comme à l'écran
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      ciColl,
      { ...ciColl, zacharie_carcasse_id: `${FEI}_002` },
      ciEtg,
      { ...ciEtg, zacharie_carcasse_id: `${FEI}_002` },
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect((prisma.carcasseIntermediaire as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { created_at: 'asc' } })
    );
    expect(pdfData().intermediaires).toEqual([
      { nom: 'Collecteur 1', role: 'Collecteur', priseEnChargeAt: new Date('2026-10-03') },
      { nom: 'ETG 1', role: 'ETG', priseEnChargeAt: new Date('2026-10-02') },
    ]);
  });

  test('examinateur sans prénom → nom seul, sans « null »', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ prenom: null, nom_de_famille: 'Dupont' } as any);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().examinateur).toBe('Dupont');
  });

  test('examinateur sans prénom ni nom → vide', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([carcasse as any]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ prenom: null, nom_de_famille: null } as any);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().examinateur).toBeNull();
  });

  test('SVI repris de la première carcasse qui en a un', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      { ...carcasse, svi_entity_id: null } as any,
      { ...carcasse, zacharie_carcasse_id: `${FEI}_002`, numero_bracelet: 'B-002' } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().svi).toBe('SVI 1');
  });

  test("carcasse acceptée par l'ETG, sans décision SVI → « Acceptée par ETG 1 »", async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
        intermediaire_carcasse_refus_motif: null,
      } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Acceptée par ETG 1');
  });

  test("carcasse prise en charge mais pas encore décidée par l'ETG → « Sans décision »", async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([{ ...ciEtg, decision_at: null }]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Sans décision');
  });

  test('carcasse seulement passée par un collecteur → « Sans décision »', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { ...ciEtg, intermediaire_entity_id: 'entity-coll', intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO },
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Sans décision');
  });

  test('carcasse acceptée par le SVI → « Acceptée », pas le nom de l’ETG', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        svi_carcasse_status: CarcasseStatus.ACCEPTE,
        svi_carcasse_status_set_at: new Date('2026-10-05'),
      } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(sviUser));
    expect(pdfData().carcasses[0].statut).toBe('Acceptée');
  });

  // Un refus annulé repasse en SANS_DECISION avec svi_carcasse_status_set_at posé par le client
  const refusAnnule = {
    ...carcasse,
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    svi_carcasse_status_set_at: new Date('2026-10-03'),
    intermediaire_carcasse_refus_motif: null as string | null,
  };

  test('refus du collecteur annulé, ETG pas encore décidé → « Sans décision »', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([refusAnnule as any]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { ...ciEtg, intermediaire_entity_id: 'entity-coll', intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO },
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Sans décision');
  });

  test("refus de l'ETG annulé puis carcasse acceptée → « Acceptée par ETG 1 »", async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([refusAnnule as any]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Acceptée par ETG 1');
  });

  test('statut vide, ETG décidé → « Acceptée par ETG 1 », comme une carcasse sans décision', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      { ...carcasse, svi_carcasse_status: null, svi_carcasse_status_set_at: null } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Acceptée par ETG 1');
  });

  test("carcasse écartée pour inspection par l'ETG → « Écarté pour inspection »", async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { ...ciEtg, ecarte_pour_inspection: true },
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Écarté pour inspection');
  });

  test('statut : le dernier intermédiaire de la carcasse décide du nom affiché', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      { ...carcasse, svi_carcasse_status: CarcasseStatus.MANQUANTE_ETG_COLLECTEUR } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { ...ciEtg, intermediaire_id: 'inter-coll', intermediaire_entity_id: 'entity-coll' },
      ciEtg,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Manquante pour ETG 1');
  });

  test('refus sans motif → « Refusée par <intermédiaire> »', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      { ...carcasse, intermediaire_carcasse_refus_motif: null } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0].statut).toBe('Refusée par ETG 1');
  });

  test('lot de petit gibier partiellement accepté → « 7 sur 10 », libellés au masculin', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        ...carcasse,
        type: CarcasseType.PETIT_GIBIER,
        espece: 'Perdrix',
        nombre_d_animaux: 10,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
        intermediaire_carcasse_refus_motif: null,
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { ...ciEtg, nombre_d_animaux_acceptes: 7 },
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0]).toEqual(
      expect.objectContaining({ nombreAnimaux: '7 sur 10', statut: 'Accepté par ETG 1' })
    );
  });

  test('lot de petit gibier sans nombre accepté → total', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      { ...carcasse, type: CarcasseType.PETIT_GIBIER, nombre_d_animaux: 10 } as any,
    ]);
    await request(app).get(URL).set('x-test-user', JSON.stringify(etgUser));
    expect(pdfData().carcasses[0]).toEqual(
      expect.objectContaining({ nombreAnimaux: '10', statut: 'Refusé par ETG 1 : Souillure' })
    );
  });

  test('numéro de fiche avec emoji ou guillemet → 200, nom de fichier assaini', async () => {
    const numero = 'ZACH-🦌"x';
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ ...carcasse, fei_numero: numero } as any]);
    vi.mocked(prisma.fei.findFirst).mockResolvedValue({ numero, examinateur_initial_user_id: null } as any);
    const res = await request(app)
      .get(`/fiche-pdf/${encodeURIComponent(numero)}/${TRANSMISSION}`)
      .set('x-test-user', JSON.stringify(sviUser));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="fiche-ZACH-___x.pdf"');
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fei_numero: numero }) })
    );
  });
});
