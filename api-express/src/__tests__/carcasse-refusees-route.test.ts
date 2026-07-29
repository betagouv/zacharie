import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, UserRoles } from '@prisma/client';

// GET /carcasse/refusees/:fei_numero — carcasses d'une fiche HORS du périmètre de synchro delta
// (refusées/manquantes/orphelines). Une carcasse refusée « sort du circuit » : ses next/current_owner
// ne suivent plus la transmission et son updated_at ne rebouge pas → le pull delta /carcasse ne la
// renvoie jamais aux détenteurs suivants ni au SVI. Cette route la fournit à la demande, par fiche.
//
// Contrat épinglé ici :
//  - l'autorisation reste au niveau carcasse : count des carcasses de la fiche DANS le périmètre
//    normal de l'utilisateur (getCarcasseAccessWhere) ; 0 → 403.
//  - la donnée renvoyée est le complément : { fei_numero, NOT: accessWhere }.

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
};

const collecteurUser = {
  id: 'user-coll',
  roles: [UserRoles.COLLECTEUR_PRO],
  activated: true,
  isZacharieAdmin: false,
};

const unknownRoleUser = {
  id: 'user-unknown',
  roles: [] as UserRoles[],
  activated: true,
  isZacharieAdmin: false,
};

const inactiveEtg = { ...etgUser, activated: false };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

const FEI = 'ZACH-2026-0001';
const ENTITY_IDS = ['entity-1', 'entity-2'];

// vitest.setup.ts ne fournit ni count ni carcasseIntermediaire.findMany — ajoutés pour ce suite.
(prisma.carcasse as any).count = vi.fn().mockResolvedValue(0);
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

const etgAccessOR = [
  { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: ENTITY_IDS } } } },
  { next_owner_entity_id: { in: ENTITY_IDS } },
  { current_owner_entity_id: { in: ENTITY_IDS } },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  (prisma.carcasse as any).count.mockResolvedValue(0);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([]);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { entity_id: 'entity-1' } as any,
    { entity_id: 'entity-2' } as any,
  ]);
});

describe('Auth / activation', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).get(`/carcasse/refusees/${FEI}`);
    expect(res.status).toBe(401);
  });

  test('non-activated user → 400, no DB query', async () => {
    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(inactiveEtg));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le compte n'est pas activé");
    expect(prisma.carcasse.count).not.toHaveBeenCalled();
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('unknown role → 403, no carcasse query', async () => {
    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(unknownRoleUser));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Vous n'avez pas les permissions.");
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});

describe('Autorisation par accès à la fiche', () => {
  test('aucune carcasse de la fiche dans le périmètre → 403, pas de fetch des refusées', async () => {
    (prisma.carcasse as any).count.mockResolvedValue(0);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Vous n'avez pas accès à cette fiche.");
    // le count d'autorisation est scopé fiche + périmètre normal de l'utilisateur
    expect(prisma.carcasse.count).toHaveBeenCalledWith({
      where: { fei_numero: FEI, OR: etgAccessOR },
    });
    // on ne va PAS chercher les carcasses hors périmètre si l'accès est refusé
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});

describe('ETG — récupération des carcasses refusées de la fiche', () => {
  test('accès OK → 200, findMany scopé { fei_numero, NOT: accessWhere }', async () => {
    (prisma.carcasse as any).count.mockResolvedValue(2); // l'ETG a bien des carcasses de la fiche
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        zacharie_carcasse_id: `${FEI}_001`,
        fei_numero: FEI,
        svi_carcasse_status: 'REFUS_ETG_COLLECTEUR',
        current_owner_entity_id: 'entity-amont',
        intermediaire_carcasse_refus_intermediaire_id: 'inter-1',
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { zacharie_carcasse_id: `${FEI}_001`, intermediaire_entity_id: 'entity-amont' } as any,
    ]);
    vi.mocked(prisma.entity.findMany).mockResolvedValue([
      { id: 'entity-amont', nom_d_usage: 'ETG Amont' } as any,
    ]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);

    // Le complément hors périmètre : toutes les carcasses de la fiche que le delta ne donne pas.
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI, NOT: { OR: etgAccessOR } },
    });

    // Les CarcasseIntermediaire (record de refus, pour le motif) sont récupérées pour ces carcasses.
    expect(prisma.carcasseIntermediaire.findMany).toHaveBeenCalledWith({
      where: { zacharie_carcasse_id: { in: [`${FEI}_001`] } },
    });

    expect(res.body.ok).toBe(true);
    expect(res.body.data.carcasses).toHaveLength(1);
    expect(res.body.data.carcasses[0].zacharie_carcasse_id).toBe(`${FEI}_001`);
    expect(res.body.data.carcassesIntermediaires).toHaveLength(1);
    expect(res.body.data.entities).toHaveLength(1);
  });

  test('COLLECTEUR_PRO utilise le même périmètre que l’ETG', async () => {
    (prisma.carcasse as any).count.mockResolvedValue(1);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(collecteurUser));

    expect(res.status).toBe(200);
    expect(prisma.carcasse.count).toHaveBeenCalledWith({
      where: { fei_numero: FEI, OR: etgAccessOR },
    });
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI, NOT: { OR: etgAccessOR } },
    });
  });
});

describe('SVI — voit les carcasses refusées en amont (champ de contrôle)', () => {
  const sviAccessWhere = {
    svi_assigned_at: { not: null },
    OR: [{ svi_entity_id: { in: ENTITY_IDS } }, { next_owner_entity_id: { in: ENTITY_IDS } }],
  };

  test('accès OK → renvoie les refusées (sans svi_assigned_at) via NOT accessWhere', async () => {
    (prisma.carcasse as any).count.mockResolvedValue(3); // fiche bien arrivée au SVI
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        zacharie_carcasse_id: `${FEI}_009`,
        fei_numero: FEI,
        svi_carcasse_status: 'REFUS_ETG_COLLECTEUR',
        svi_assigned_at: null, // refusée en amont → jamais assignée au SVI
      } as any,
    ]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(sviUser));

    expect(res.status).toBe(200);
    // autorisation : au moins une carcasse de la fiche est bien dans le périmètre SVI
    expect(prisma.carcasse.count).toHaveBeenCalledWith({
      where: { fei_numero: FEI, ...sviAccessWhere },
    });
    // complément : les carcasses de la fiche hors périmètre SVI (svi_assigned_at null → refusées)
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith({
      where: { fei_numero: FEI, NOT: sviAccessWhere },
    });
    expect(res.body.data.carcasses[0].svi_assigned_at).toBeNull();
  });

  test('fiche jamais arrivée au SVI → 403', async () => {
    (prisma.carcasse as any).count.mockResolvedValue(0);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(sviUser));

    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});
