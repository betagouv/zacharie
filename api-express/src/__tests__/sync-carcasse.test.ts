import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncCarcasse } from '~/utils/sync-carcasse';
import prisma from '~/prisma';

import { UserRoles, EntityRelationType } from '@prisma/client';
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

const baseFei = { numero: 'FEI-1', deleted_at: null } as any;

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
      data: { deleted_at: '2026-03-01' },
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
        svi_carcasse_status: 'REFUSE',
        svi_carcasse_status_set_at: assignedAt,
      } as any,
      chasseur,
      scope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.svi_assigned_at).toBe(assignedAt);
    expect(updateCall.data.svi_entity_id).toBe('entity-svi');
    expect(updateCall.data.svi_carcasse_status).toBe('REFUSE');
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

// Scénario : le chasseur modifie la carcasse hors ligne lundi, l'ETG la prend en charge mardi, le
// chasseur synchronise jeudi avec son snapshot de lundi.
describe('syncCarcasse — chaîne de transmission écrite par le seul détenteur', () => {
  const etgUser = {
    id: 'user-etg',
    roles: [UserRoles.ETG],
    activated: true,
    isZacharieAdmin: false,
  } as unknown as User;

  const priseEnChargeParEtg = {
    ...baseCarcasse,
    current_owner_role: 'ETG',
    current_owner_user_id: 'user-etg',
    current_owner_entity_id: 'entity-etg',
    next_owner_role: null,
    next_owner_user_id: null,
    next_owner_entity_id: null,
    prev_owner_role: 'PREMIER_DETENTEUR',
    prev_owner_user_id: 'user-chasseur',
    prev_owner_entity_id: null,
    svi_carcasse_status: 'ACCEPTE',
  } as any;

  const staleChasseurSnapshot = {
    fei_numero: 'FEI-1',
    examinateur_commentaire: 'corrigé lundi',
    current_owner_role: 'PREMIER_DETENTEUR',
    current_owner_user_id: 'user-chasseur',
    current_owner_entity_id: null,
    next_owner_role: 'ETG',
    next_owner_user_id: null,
    next_owner_entity_id: 'entity-etg',
    prev_owner_role: 'EXAMINATEUR_INITIAL',
    prev_owner_user_id: 'user-chasseur',
    prev_owner_entity_id: null,
    latest_intermediaire_user_id: null,
    svi_assigned_at: null,
    svi_entity_id: null,
    svi_carcasse_status: 'SANS_DECISION',
    svi_carcasse_status_set_at: new Date(),
  } as any;

  const chasseurScope = fakeSyncScope({ entityIds: [] });

  // Le test de suppression plus haut laisse une valeur en file sur findFirst.
  beforeEach(() => {
    vi.mocked(prisma.carcasse.findFirst).mockReset();
  });

  test("le snapshot d'un ancien détenteur ne réécrit pas la chaîne, le reste de sa saisie passe", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(priseEnChargeParEtg);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(priseEnChargeParEtg);

    await syncCarcasse('FEI-1', 'ZC-1', staleChasseurSnapshot, chasseur, chasseurScope);

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.examinateur_commentaire).toBe('corrigé lundi');
    for (const field of [
      'current_owner_role',
      'current_owner_user_id',
      'current_owner_entity_id',
      'next_owner_role',
      'next_owner_entity_id',
      'prev_owner_role',
      'prev_owner_user_id',
      'latest_intermediaire_user_id',
      'svi_assigned_at',
      'svi_entity_id',
      'svi_carcasse_status',
      'svi_carcasse_status_set_at',
    ]) {
      expect(updateCall.data).not.toHaveProperty(field);
    }
    expect(prisma.entityAndUserRelations.findFirst).not.toHaveBeenCalled();
  });

  test('un collègue du détenteur courant (même entité) fait avancer la chaîne', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(priseEnChargeParEtg);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(priseEnChargeParEtg);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', next_owner_role: 'SVI', next_owner_entity_id: 'entity-svi' } as any,
      { ...etgUser, id: 'user-etg-collegue' } as User,
      fakeSyncScope({ entityIds: ['entity-etg'] })
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.next_owner_role).toBe('SVI');
    expect(updateCall.data.next_owner_entity_id).toBe('entity-svi');
  });

  const transmiseAEtg = {
    ...baseCarcasse,
    current_owner_role: 'PREMIER_DETENTEUR',
    current_owner_user_id: 'user-chasseur',
    current_owner_entity_id: null,
    next_owner_role: 'ETG',
    next_owner_user_id: null,
    next_owner_entity_id: 'entity-etg',
  } as any;

  test('le prochain détenteur désigné prend la carcasse en charge', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(transmiseAEtg);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(transmiseAEtg);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      {
        fei_numero: 'FEI-1',
        current_owner_role: 'ETG',
        current_owner_entity_id: 'entity-etg',
        next_owner_role: null,
        prev_owner_role: 'PREMIER_DETENTEUR',
      } as any,
      etgUser,
      fakeSyncScope({ entityIds: ['entity-etg'] })
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.current_owner_role).toBe('ETG');
    expect(updateCall.data.next_owner_role).toBeNull();
    expect(updateCall.data.prev_owner_role).toBe('PREMIER_DETENTEUR');
  });

  test('le chasseur encore détenteur (transmise, pas prise en charge) peut annuler sa transmission', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(transmiseAEtg);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(transmiseAEtg);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', next_owner_role: null, next_owner_entity_id: null } as any,
      chasseur,
      chasseurScope
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.next_owner_role).toBeNull();
    expect(updateCall.data.next_owner_entity_id).toBeNull();
  });
});
