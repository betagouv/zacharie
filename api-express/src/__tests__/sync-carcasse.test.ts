import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncCarcasse } from '~/utils/sync-carcasse';
import prisma from '~/prisma';
import { UserRoles, EntityRelationType } from '@prisma/client';
import type { User } from '@prisma/client';

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
    await expect(syncCarcasse('', 'ZC-1', {} as any, chasseur)).rejects.toThrow(
      'Le numéro de fiche est obligatoire'
    );
  });

  test('parent FEI not found → throws "Fiche non trouvée"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);
    await expect(syncCarcasse('FEI-MISSING', 'ZC-1', {} as any, chasseur)).rejects.toThrow(
      'Fiche non trouvée'
    );
  });

  test('missing zacharie_carcasse_id → throws', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    await expect(syncCarcasse('FEI-1', '', {} as any, chasseur)).rejects.toThrow(
      'Le numéro de la carcasse est obligatoire'
    );
  });
});

describe('syncCarcasse — create', () => {
  test('new carcasse without numero_bracelet → throws "Le numéro de marquage est obligatoire"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);

    await expect(
      syncCarcasse('FEI-1', 'ZC-NEW', { fei_numero: 'FEI-1' } as any, chasseur)
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
      chasseur
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
      chasseur
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
      chasseur
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
      chasseur
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
      chasseur
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
      chasseur
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
      chasseur
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
      chasseur
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
      sviUser
    );

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateCall.data.svi_carcasse_commentaire).toBe('inspected');
    expect(updateCall.data.svi_ipm1_decision).toBe('MISE_SUR_LE_MARCHE');
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
      chasseur
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
