import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncCarcasse } from '~/utils/sync-carcasse';
import prisma from '~/prisma';

import { UserRoles, EntityRelationType, CarcasseStatus, FeiOwnerRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { fakeSyncScope } from './fake-sync-scope';

// Ce fichier couvre le mapping des champs. L'autorisation d'écriture a ses propres tests
// (permissions-sync-write.test.ts), on passe ici un périmètre permissif.
const scope = fakeSyncScope();

const chasseur = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const baseFei = {
  numero: 'FEI-1',
  deleted_at: null,
  examinateur_initial_user_id: 'user-chasseur',
  premier_detenteur_user_id: 'user-chasseur',
} as any;

const baseCarcasse = {
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: 'FEI-1',
  numero_bracelet: 'BR-1',
  examinateur_anomalies_carcasse: ['old-anomaly'],
  examinateur_anomalies_abats: ['old-abat'],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncCarcasse — validation', () => {
  test('missing fei_numero → throws', async () => {
    await expect(syncCarcasse('', 'ZC-1', {} as any, chasseur, scope)).rejects.toThrow(
      'Le numéro de fiche est obligatoire'
    );
  });

  test('parent FEI not found → throws "Fiche non trouvée"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);
    await expect(syncCarcasse('FEI-MISSING', 'ZC-1', {} as any, chasseur, scope)).rejects.toThrow(
      'Fiche non trouvée'
    );
  });

  test('missing zacharie_carcasse_id → throws', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    await expect(syncCarcasse('FEI-1', '', {} as any, chasseur, scope)).rejects.toThrow(
      'Le numéro de la carcasse est obligatoire'
    );
  });
});

describe('syncCarcasse — create', () => {
  test('new carcasse without numero_bracelet → throws "Le numéro de marquage est obligatoire"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);

    await expect(
      syncCarcasse('FEI-1', 'ZC-NEW', { fei_numero: 'FEI-1' } as any, chasseur, scope)
    ).rejects.toThrow('Le numéro de marquage est obligatoire');

    expect(prisma.carcasse.create).not.toHaveBeenCalled();
  });

  test('new carcasse with numero_bracelet → creates with is_synced=true then updates', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', numero_bracelet: 'BR-1' } as any,
      chasseur,
      scope
    );

    const createCall = vi.mocked(prisma.carcasse.create).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      zacharie_carcasse_id: 'ZC-1',
      fei_numero: 'FEI-1',
      numero_bracelet: 'BR-1',
      is_synced: true,
    });
  });

  test("created_by_user_id vient de l'auteur de la requête, jamais du body", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', numero_bracelet: 'BR-1', created_by_user_id: 'user-victime' } as any,
      chasseur,
      scope
    );

    const createCall = vi.mocked(prisma.carcasse.create).mock.calls[0][0];
    expect(createCall.data.created_by_user_id).toBe(chasseur.id);
    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('created_by_user_id');
  });
});

describe('syncCarcasse — update', () => {
  test('hasOwnProperty semantics: omitted field not in update payload', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', heure_evisceration: '14:30' } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('heure_evisceration', '14:30');
    expect(updateCall.data).not.toHaveProperty('numero_bracelet');
    expect(updateCall.data).not.toHaveProperty('espece');
    expect(updateCall.data).toHaveProperty('is_synced', true);
  });

  test('examinateur_carcasse_sans_anomalie=true clears BOTH anomaly arrays', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', examinateur_carcasse_sans_anomalie: true } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.examinateur_carcasse_sans_anomalie).toBe(true);
    expect(updateCall.data.examinateur_anomalies_carcasse).toEqual([]);
    expect(updateCall.data.examinateur_anomalies_abats).toEqual([]);
  });

  test('examinateur_carcasse_sans_anomalie=false does NOT clear anomalies', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', examinateur_carcasse_sans_anomalie: false } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.examinateur_carcasse_sans_anomalie).toBe(false);
    expect(updateCall.data).not.toHaveProperty('examinateur_anomalies_carcasse');
    expect(updateCall.data).not.toHaveProperty('examinateur_anomalies_abats');
  });

  test('anomalies arrays passed in body are filtered to drop falsy values', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        examinateur_anomalies_carcasse: ['a1', '', null, 'a2'],
        examinateur_anomalies_abats: [null, undefined],
      } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.examinateur_anomalies_carcasse).toEqual(['a1', 'a2']);
    expect(updateCall.data.examinateur_anomalies_abats).toEqual([]);
  });

  test('nombre_d_animaux is coerced to Number', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', nombre_d_animaux: '3' } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.nombre_d_animaux).toBe(3);
  });
});

describe('syncCarcasse — deletion', () => {
  test('soft-delete cascades to CarcasseIntermediaire', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    // First findFirst → returns existing carcasse for the initial lookup
    // Second findFirst → returns existing carcasse for the delete branch
    vi.mocked(prisma.carcasse.findFirst)
      .mockResolvedValueOnce(baseCarcasse)
      .mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({
      ...baseCarcasse,
      deleted_at: '2026-03-01',
    } as any);

    const result = await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', deleted_at: '2026-03-01' } as any,
      chasseur,
      scope
    );

    expect(result.isDeleted).toBe(true);
    expect(prisma.carcasseIntermediaire.updateMany).toHaveBeenCalledWith({
      where: { zacharie_carcasse_id: 'ZC-1' },
      data: { deleted_at: '2026-03-01', version: { increment: 1 }, version_user_id: expect.any(String) },
    });
  });
});

describe('syncCarcasse — SVI-only fields', () => {
  test('SVI fields are NOT applied for a non-SVI user', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        svi_carcasse_commentaire: 'should-be-ignored',
        svi_ipm1_decision: 'should-be-ignored',
      } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('svi_carcasse_commentaire');
    expect(updateCall.data).not.toHaveProperty('svi_ipm1_decision');
  });

  test('SVI fields ARE applied for an SVI user', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        svi_carcasse_commentaire: 'inspected',
        svi_ipm1_decision: 'MISE_SUR_LE_MARCHE',
      } as any,
      sviUser,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.svi_carcasse_commentaire).toBe('inspected');
    expect(updateCall.data.svi_ipm1_decision).toBe('MISE_SUR_LE_MARCHE');
  });

  test('la clôture SVI est ignorée pour un non-SVI', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        svi_user_id: 'user-chasseur',
        svi_closed_at: new Date(),
        svi_closed_by_user_id: 'user-chasseur',
      } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('svi_user_id');
    expect(updateCall.data).not.toHaveProperty('svi_closed_at');
    expect(updateCall.data).not.toHaveProperty('svi_closed_by_user_id');
  });

  test('la clôture SVI est appliquée pour un SVI', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    const closedAt = new Date();
    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        svi_user_id: 'user-svi',
        svi_closed_at: closedAt,
        svi_closed_by_user_id: 'user-svi',
      } as any,
      sviUser,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.svi_user_id).toBe('user-svi');
    expect(updateCall.data.svi_closed_at).toBe(closedAt);
    expect(updateCall.data.svi_closed_by_user_id).toBe('user-svi');
  });

  // L'assignation au SVI est faite par l'ETG, et le statut est recalculé par le client à chaque
  // modification quel que soit le rôle : ces champs ne doivent pas tomber dans le périmètre SVI.
  test('assignation SVI et statut restent écrivables par un non-SVI', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    const assignedAt = new Date();
    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        svi_assigned_at: assignedAt,
        svi_entity_id: 'entity-svi',
        svi_carcasse_status: 'REFUS_ETG_COLLECTEUR',
        svi_carcasse_status_set_at: assignedAt,
      } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.svi_assigned_at).toBe(assignedAt);
    expect(updateCall.data.svi_entity_id).toBe('entity-svi');
    expect(updateCall.data.svi_carcasse_status).toBe('REFUS_ETG_COLLECTEUR');
    expect(updateCall.data.svi_carcasse_status_set_at).toBe(assignedAt);
  });
});

describe('syncCarcasse — next_owner_entity_id side effect', () => {
  test('creates CAN_TRANSMIT relation if missing', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({} as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', next_owner_entity_id: 'entity-Y' } as any,
      chasseur,
      scope
    );

    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity_id: 'entity-Y',
        owner_id: chasseur.id,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      }),
    });
  });
});

describe('syncCarcasse — champs réservés à un rôle', () => {
  const etgUser = {
    id: 'user-etg',
    roles: [UserRoles.ETG],
    activated: true,
    isZacharieAdmin: false,
  } as unknown as User;
  // L'ETG détient la carcasse mais n'est ni examinateur, ni premier détenteur.
  const etgScope = fakeSyncScope({ isFeiOwner: () => false, isPremierDetenteur: () => false });
  const carcasseDuChasseur = { ...baseCarcasse, created_by_user_id: 'user-chasseur' };

  // Fiche et carcasse passées en opts, comme le fait le /sync en masse.
  async function syncAsEtg(body: object, existing = carcasseDuChasseur) {
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(existing);
    await syncCarcasse('FEI-1', 'ZC-1', { fei_numero: 'FEI-1', ...body } as any, etgUser, etgScope, {
      existingFei: baseFei,
      existingCarcasse: existing,
    });
    return vi.mocked(prisma.carcasse.update).mock.calls[0][0].data;
  }

  test("un membre de l'asso premier détenteur enregistre qu'il a validé hors ligne", async () => {
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseDuChasseur);
    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', premier_detenteur_offline: true } as any,
      etgUser,
      fakeSyncScope({ isFeiOwner: () => false, isPremierDetenteur: () => true }),
      { existingFei: baseFei, existingCarcasse: carcasseDuChasseur }
    );
    const data = vi.mocked(prisma.carcasse.update).mock.calls[0][0].data;
    expect(data.premier_detenteur_offline).toBe(true);
  });

  test("l'examen et l'identité de la carcasse sont ignorés pour un détenteur aval", async () => {
    const data = await syncAsEtg({
      numero_bracelet: 'BR-AUTRE',
      espece: 'Sanglier',
      nombre_d_animaux: 4,
      examinateur_carcasse_sans_anomalie: true,
      examinateur_anomalies_carcasse: ['a1'],
      examinateur_commentaire: 'rien',
      examinateur_signed_at: new Date(),
      examinateur_initial_approbation_mise_sur_le_marche: true,
    });
    for (const field of [
      'numero_bracelet',
      'espece',
      'nombre_d_animaux',
      'examinateur_carcasse_sans_anomalie',
      'examinateur_anomalies_carcasse',
      'examinateur_anomalies_abats',
      'examinateur_commentaire',
      'examinateur_signed_at',
      'examinateur_initial_approbation_mise_sur_le_marche',
    ]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  test("l'auteur d'une carcasse ajoutée en aval en saisit l'identité, pas l'examen", async () => {
    const data = await syncAsEtg(
      { numero_bracelet: 'BR-AUTRE', espece: 'Sanglier', examinateur_anomalies_carcasse: ['a1'] },
      { ...baseCarcasse, created_by_user_id: etgUser.id }
    );
    expect(data.numero_bracelet).toBe('BR-AUTRE');
    expect(data.espece).toBe('Sanglier');
    expect(data).not.toHaveProperty('examinateur_anomalies_carcasse');
  });

  test('un détenteur aval efface stockage et transport du premier détenteur, sans pouvoir les remplir', async () => {
    const data = await syncAsEtg({
      premier_detenteur_depot_type: null,
      premier_detenteur_transport_type: 'PREMIER_DETENTEUR',
      premier_detenteur_prochain_detenteur_id_cache: 'entity-x',
      consommateur_final_usage_domestique: new Date(),
    });
    expect(data).toHaveProperty('premier_detenteur_depot_type', null);
    expect(data).not.toHaveProperty('premier_detenteur_transport_type');
    expect(data).not.toHaveProperty('premier_detenteur_prochain_detenteur_id_cache');
    expect(data).not.toHaveProperty('consommateur_final_usage_domestique');
  });

  test('une carcasse ajoutée en aval reprend les choix du premier détenteur des autres carcasses', async () => {
    const carcasseCreee = { ...baseCarcasse, created_by_user_id: etgUser.id };
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(carcasseCreee);
    // d'autres tests de ce fichier laissent des valeurs findFirst non consommées dans la file
    vi.mocked(prisma.carcasse.findFirst).mockReset();
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce({
      premier_detenteur_depot_type: 'AUCUN',
      premier_detenteur_transport_type: 'PREMIER_DETENTEUR',
      premier_detenteur_prochain_detenteur_id_cache: 'entity-etg',
    } as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseCreee);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        numero_bracelet: 'BR-1',
        premier_detenteur_transport_type: 'CHOIX-FALSIFIE',
        premier_detenteur_prochain_detenteur_id_cache: 'entity-falsifiee',
      } as any,
      etgUser,
      etgScope,
      { existingFei: baseFei, existingCarcasse: null }
    );

    const data = vi.mocked(prisma.carcasse.update).mock.calls[0][0].data;
    expect(data).toMatchObject({
      premier_detenteur_depot_type: 'AUCUN',
      premier_detenteur_transport_type: 'PREMIER_DETENTEUR',
      premier_detenteur_prochain_detenteur_id_cache: 'entity-etg',
    });
  });

  test("une carcasse ajoutée en aval reprend les choix d'une carcasse de la branche de l'intermédiaire", async () => {
    const accessWhere = { premier_detenteur_prochain_detenteur_id_cache: 'entity-etg-2' };
    const carcasseCreee = { ...baseCarcasse, created_by_user_id: etgUser.id };
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(carcasseCreee);
    vi.mocked(prisma.carcasse.findFirst).mockReset();
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseCreee);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', numero_bracelet: 'BR-1' } as any,
      etgUser,
      { ...etgScope, carcasseAccessWhere: accessWhere },
      { existingFei: baseFei, existingCarcasse: null }
    );

    const where = vi.mocked(prisma.carcasse.findFirst).mock.calls[0][0]!.where as any;
    expect(where.AND).toContainEqual(accessWhere);
  });

  test("une carcasse créée par l'examinateur ne cherche pas de carcasse soeur", async () => {
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasse.findFirst).mockReset();
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', numero_bracelet: 'BR-1' } as any,
      etgUser,
      fakeSyncScope({ isFeiOwner: () => true, isPremierDetenteur: () => false }),
      { existingFei: baseFei, existingCarcasse: null }
    );

    expect(prisma.carcasse.findFirst).not.toHaveBeenCalled();
  });

  test("l'auteur d'une action est toujours l'utilisateur courant, pour une de ses entités", async () => {
    const data = await syncAsEtg({
      intermediaire_closed_at: new Date(),
      intermediaire_closed_by_user_id: 'user-autre',
      intermediaire_closed_by_entity_id: 'entity-autre',
      next_owner_sous_traite_by_user_id: 'user-autre',
      next_owner_sous_traite_by_entity_id: 'entity-etg',
    });
    expect(data.intermediaire_closed_by_user_id).toBe(etgUser.id);
    expect(data).not.toHaveProperty('intermediaire_closed_by_entity_id');
    expect(data.next_owner_sous_traite_by_user_id).toBe(etgUser.id);
    expect(data.next_owner_sous_traite_by_entity_id).toBe('entity-etg');
  });

  test('une valeur déjà enregistrée est conservée', async () => {
    const data = await syncAsEtg(
      { intermediaire_closed_by_user_id: 'user-collegue', intermediaire_closed_by_entity_id: 'entity-autre' },
      {
        ...carcasseDuChasseur,
        intermediaire_closed_by_user_id: 'user-collegue',
        intermediaire_closed_by_entity_id: 'entity-autre',
      }
    );
    expect(data.intermediaire_closed_by_user_id).toBe('user-collegue');
    expect(data.intermediaire_closed_by_entity_id).toBe('entity-autre');
  });

  test('un non-SVI ne pose pas de décision SVI', async () => {
    const data = await syncAsEtg({
      svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
      svi_carcasse_status_set_at: new Date(),
    });
    expect(data).not.toHaveProperty('svi_carcasse_status');
    expect(data).not.toHaveProperty('svi_carcasse_status_set_at');
  });

  test('un non-SVI ne réécrit pas une décision SVI', async () => {
    const data = await syncAsEtg(
      { svi_carcasse_status: CarcasseStatus.SANS_DECISION },
      { ...carcasseDuChasseur, svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE }
    );
    expect(data).not.toHaveProperty('svi_carcasse_status');
  });

  test("acceptation automatique 10 jours après l'assignation au SVI", async () => {
    const data = await syncAsEtg(
      { svi_carcasse_status: CarcasseStatus.ACCEPTE },
      {
        ...carcasseDuChasseur,
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_assigned_at: new Date(Date.now() - 11 * 24 * 3600 * 1000),
      }
    );
    expect(data.svi_carcasse_status).toBe(CarcasseStatus.ACCEPTE);
  });

  test("un manque de l'intermédiaire remplace une acceptation automatique", async () => {
    const data = await syncAsEtg(
      { svi_carcasse_status: CarcasseStatus.MANQUANTE_ETG_COLLECTEUR },
      { ...carcasseDuChasseur, svi_carcasse_status: CarcasseStatus.ACCEPTE }
    );
    expect(data.svi_carcasse_status).toBe(CarcasseStatus.MANQUANTE_ETG_COLLECTEUR);
  });

  test("un refus de l'intermédiaire ne remplace pas une acceptation du SVI après inspection", async () => {
    const data = await syncAsEtg(
      { svi_carcasse_status: CarcasseStatus.REFUS_ETG_COLLECTEUR },
      { ...carcasseDuChasseur, svi_carcasse_status: CarcasseStatus.ACCEPTE, svi_ipm1_date: new Date() }
    );
    expect(data).not.toHaveProperty('svi_carcasse_status');
  });
});

describe('syncCarcasse — suppression', () => {
  const deletedAt = new Date().toISOString();

  test("un détenteur aval ne supprime pas une carcasse qu'il n'a pas ajoutée", async () => {
    const existing = {
      ...baseCarcasse,
      created_by_user_id: 'user-chasseur',
    };
    await expect(
      syncCarcasse(
        'FEI-1',
        'ZC-1',
        { fei_numero: 'FEI-1', deleted_at: deletedAt } as any,
        { id: 'user-etg', roles: [UserRoles.ETG] } as unknown as User,
        fakeSyncScope({ isFeiOwner: () => false, isPremierDetenteur: () => false }),
        { existingFei: baseFei, existingCarcasse: existing }
      )
    ).rejects.toThrow('Vous ne pouvez pas supprimer cette carcasse');
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test("l'examinateur ne supprime plus une carcasse prise en charge en aval", async () => {
    const existing = {
      ...baseCarcasse,
      created_by_user_id: chasseur.id,
      current_owner_role: FeiOwnerRole.ETG,
    };
    await expect(
      syncCarcasse('FEI-1', 'ZC-1', { fei_numero: 'FEI-1', deleted_at: deletedAt } as any, chasseur, scope, {
        existingFei: baseFei,
        existingCarcasse: existing,
      })
    ).rejects.toThrow('Vous ne pouvez pas supprimer cette carcasse');
  });

  test("l'examinateur supprime une carcasse tant qu'elle n'est pas prise en charge", async () => {
    const existing = {
      ...baseCarcasse,
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
    };
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);
    const result = await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', deleted_at: deletedAt } as any,
      chasseur,
      scope,
      { existingFei: baseFei, existingCarcasse: existing }
    );
    expect(result.isDeleted).toBe(true);
  });

  const etgUser = { id: 'user-etg', roles: [UserRoles.ETG] } as unknown as User;
  const etgScope = fakeSyncScope({ isFeiOwner: () => false, isPremierDetenteur: () => false });
  const carcasseAjoutee = {
    ...baseCarcasse,
    created_by_user_id: etgUser.id,
    current_owner_role: FeiOwnerRole.ETG,
  };
  const supprimerEnTantQueEtg = (existing: typeof carcasseAjoutee) =>
    syncCarcasse('FEI-1', 'ZC-1', { fei_numero: 'FEI-1', deleted_at: deletedAt } as any, etgUser, etgScope, {
      existingFei: baseFei,
      existingCarcasse: existing,
    });

  test("l'auteur d'une carcasse ajoutée en aval la supprime (annulation de sa demande)", async () => {
    vi.mocked(prisma.carcasseModificationRequest.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);
    const result = await supprimerEnTantQueEtg(carcasseAjoutee);
    expect(result.isDeleted).toBe(true);
  });

  test("l'auteur d'une carcasse ajoutée en aval ne la supprime pas sans demande en attente", async () => {
    vi.mocked(prisma.carcasseModificationRequest.count).mockResolvedValueOnce(0);
    await expect(supprimerEnTantQueEtg(carcasseAjoutee)).rejects.toThrow(
      'Vous ne pouvez pas supprimer cette carcasse'
    );
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test("l'auteur d'une carcasse ajoutée en aval ne la supprime plus après l'inspection SVI", async () => {
    vi.mocked(prisma.carcasseModificationRequest.count).mockResolvedValueOnce(1);
    await expect(
      supprimerEnTantQueEtg({ ...carcasseAjoutee, svi_ipm1_signed_at: new Date() })
    ).rejects.toThrow('Vous ne pouvez pas supprimer cette carcasse');
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });
});
