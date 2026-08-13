import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { Prisma, UserRoles } from '@prisma/client';

// GET /carcasse/refusees/:fei_numero — carcasses refusées ou manquantes en amont, HORS du périmètre
// de synchro delta. Une carcasse refusée « sort du circuit » : ses next/current_owner ne suivent
// plus la transmission et son updated_at ne rebouge pas → le pull delta /carcasse ne la renvoie
// jamais aux détenteurs suivants ni au SVI. Cette route la fournit à la demande, par fiche.
//
// Contrat épinglé ici :
//  - l'autorisation reste au niveau carcasse : les carcasses de la fiche DANS le périmètre normal
//    de l'utilisateur (getCarcasseAccessWhere) ; aucune → 403.
//  - la même requête relève les groupes de dispatch (premier détenteur → prochain détenteur) de
//    l'utilisateur sur cette fiche.
//  - la donnée renvoyée est le complément, restreint à CES groupes ET aux refusées/manquantes.
//    Les autres carcasses de la fiche (parties chez un autre destinataire) ne sortent jamais : hors
//    du champ de contrôle, et côté client elles pollueraient les vues transverses (recherche,
//    transmissions) qui bouclent sur le store sans refiltrer.

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

// vitest.setup.ts ne fournit pas carcasseIntermediaire.findMany — ajouté pour cette suite.
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

const etgAccessWhere: Prisma.CarcasseWhereInput = {
  OR: [
    { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: ENTITY_IDS } } } },
    { next_owner_entity_id: { in: ENTITY_IDS } },
    { current_owner_entity_id: { in: ENTITY_IDS } },
  ],
};

const sviAccessWhere: Prisma.CarcasseWhereInput = {
  svi_assigned_at: { not: null },
  OR: [{ svi_entity_id: { in: ENTITY_IDS } }, { next_owner_entity_id: { in: ENTITY_IDS } }],
};

// 1re requête : autorisation + relevé des groupes de dispatch de l'utilisateur sur la fiche.
function expectedAuthQuery(accessWhere: Prisma.CarcasseWhereInput) {
  return {
    where: { fei_numero: FEI, ...accessWhere },
    select: { premier_detenteur_prochain_detenteur_id_cache: true },
    distinct: ['premier_detenteur_prochain_detenteur_id_cache'],
  };
}

// 2e requête : le complément, restreint aux groupes de l'utilisateur et aux refusées/manquantes.
function expectedDataQuery(
  accessWhere: Prisma.CarcasseWhereInput,
  dispatchIds: Array<string>,
  withNullDispatch = false
): { where: Prisma.CarcasseWhereInput } {
  return {
    where: {
      fei_numero: FEI,
      NOT: accessWhere,
      AND: [
        {
          OR: [
            { premier_detenteur_prochain_detenteur_id_cache: { in: dispatchIds } },
            ...(withNullDispatch ? [{ premier_detenteur_prochain_detenteur_id_cache: null }] : []),
          ],
        },
        {
          OR: [
            { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
            { intermediaire_carcasse_manquante: true },
          ],
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
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
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Vous n'avez pas accès à cette fiche.");
    // la requête d'autorisation est scopée fiche + périmètre normal de l'utilisateur
    expect(prisma.carcasse.findMany).toHaveBeenCalledWith(expectedAuthQuery(etgAccessWhere));
    // on ne va PAS chercher les carcasses hors périmètre si l'accès est refusé
    expect(prisma.carcasse.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('ETG — récupération des carcasses refusées de la fiche', () => {
  test('accès OK → 200, complément scopé aux groupes de dispatch de l’ETG et aux refusées', async () => {
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([{ premier_detenteur_prochain_detenteur_id_cache: 'etg-moi' } as any])
      .mockResolvedValueOnce([
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
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(1, expectedAuthQuery(etgAccessWhere));
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(
      2,
      expectedDataQuery(etgAccessWhere, ['etg-moi'])
    );

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

  test('fiche dispatchée à plusieurs destinataires → seuls les groupes de l’ETG sont interrogés', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      { premier_detenteur_prochain_detenteur_id_cache: 'etg-moi' } as any,
      { premier_detenteur_prochain_detenteur_id_cache: 'collecteur-moi' } as any,
    ]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);
    // 'etg-autre' n'est pas dans la liste : les carcasses parties chez un autre destinataire ne
    // sortent jamais de cette route.
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(
      2,
      expectedDataQuery(etgAccessWhere, ['etg-moi', 'collecteur-moi'])
    );
  });

  test('fiche sans dispatch (id null) → le groupe null est interrogé explicitement', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      { premier_detenteur_prochain_detenteur_id_cache: null } as any,
    ]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(2, expectedDataQuery(etgAccessWhere, [], true));
  });

  test('COLLECTEUR_PRO utilise le même périmètre que l’ETG', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      { premier_detenteur_prochain_detenteur_id_cache: 'coll-moi' } as any,
    ]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(collecteurUser));

    expect(res.status).toBe(200);
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(1, expectedAuthQuery(etgAccessWhere));
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(
      2,
      expectedDataQuery(etgAccessWhere, ['coll-moi'])
    );
  });
});

describe('SVI — voit les carcasses refusées en amont (champ de contrôle)', () => {
  test('accès OK → renvoie les refusées (sans svi_assigned_at) via NOT accessWhere', async () => {
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([{ premier_detenteur_prochain_detenteur_id_cache: 'etg-amont' } as any])
      .mockResolvedValueOnce([
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
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(1, expectedAuthQuery(sviAccessWhere));
    // complément : les refusées du même groupe de dispatch (svi_assigned_at null → hors périmètre)
    expect(prisma.carcasse.findMany).toHaveBeenNthCalledWith(
      2,
      expectedDataQuery(sviAccessWhere, ['etg-amont'])
    );
    expect(res.body.data.carcasses[0].svi_assigned_at).toBeNull();
  });

  test('fiche jamais arrivée au SVI → 403', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`/carcasse/refusees/${FEI}`)
      .set('x-test-user', JSON.stringify(sviUser));

    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).toHaveBeenCalledTimes(1);
  });
});
