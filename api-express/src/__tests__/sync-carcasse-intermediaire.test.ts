import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';

const baseFei = { numero: 'FEI-1', deleted_at: null } as any;

const baseCarcasse = {
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: 'FEI-1',
  numero_bracelet: 'BR-1',
} as any;

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const baseCi = {
  fei_numero: 'FEI-1',
  zacharie_carcasse_id: 'ZC-1',
  intermediaire_id: 'INT-1',
  intermediaire_entity_id: 'entity-A',
  intermediaire_role: 'ETG',
  intermediaire_user_id: 'user-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Par défaut, l'utilisateur travaille pour entity-A.
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-A' }] as any);
});

describe('syncCarcasseIntermediaire — validation', () => {
  test('missing fei_numero → throws', async () => {
    await expect(syncCarcasseIntermediaire('', 'INT-1', 'ZC-1', baseCi as any, etgUser)).rejects.toThrow(
      'Le numéro de fiche est obligatoire'
    );
  });

  test('parent FEI not found → throws "Fiche non trouvée"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);

    await expect(
      syncCarcasseIntermediaire('FEI-MISSING', 'INT-1', 'ZC-1', baseCi as any, etgUser)
    ).rejects.toThrow('Fiche non trouvée');
  });

  test('missing zacharie_carcasse_id → throws', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);

    await expect(syncCarcasseIntermediaire('FEI-1', 'INT-1', '', baseCi as any, etgUser)).rejects.toThrow(
      'Le numéro de la carcasse est obligatoire'
    );
  });

  test('carcasse not found → throws "Carcasse not found"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);

    await expect(syncCarcasseIntermediaire('FEI-1', 'INT-1', 'ZC-1', baseCi as any, etgUser)).rejects.toThrow(
      'Carcasse not found'
    );
  });

  test('missing intermediaire_id → throws', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);

    await expect(syncCarcasseIntermediaire('FEI-1', '', 'ZC-1', baseCi as any, etgUser)).rejects.toThrow(
      "L'identifiant du destinataire est obligatoire"
    );
  });
});

describe('syncCarcasseIntermediaire — upsert', () => {
  test('upserts using composite key fei_numero + zacharie_carcasse_id + intermediaire_id', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      {
        ...baseCi,
        commentaire: 'OK',
        intermediaire_poids: 42,
      } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.where).toEqual({
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: 'FEI-1',
        zacharie_carcasse_id: 'ZC-1',
        intermediaire_id: 'INT-1',
      },
    });
    expect(upsertCall.create).toMatchObject({
      fei_numero: 'FEI-1',
      zacharie_carcasse_id: 'ZC-1',
      intermediaire_id: 'INT-1',
      numero_bracelet: 'BR-1',
      commentaire: 'OK',
      intermediaire_poids: 42,
      is_synced: true,
    });
    // l'update reprend le create, moins l'identité de l'intermédiaire
    expect(upsertCall.update).toEqual({
      ...upsertCall.create,
      intermediaire_entity_id: undefined,
      intermediaire_role: undefined,
      intermediaire_user_id: undefined,
    });
  });

  test('hasOwnProperty semantics: omitted fields not in payload', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire('FEI-1', 'INT-1', 'ZC-1', baseCi as any, etgUser);

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create).not.toHaveProperty('commentaire');
    expect(upsertCall.create).not.toHaveProperty('intermediaire_poids');
    expect(upsertCall.create).not.toHaveProperty('refus');
  });

  test('nombre_d_animaux_acceptes coerces undefined-ish to null', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      {
        ...baseCi,
        nombre_d_animaux_acceptes: undefined,
      } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create.nombre_d_animaux_acceptes).toBeNull();
  });

  test('nombre_d_animaux_acceptes=0 is kept as 0 (not coerced to null)', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      {
        ...baseCi,
        nombre_d_animaux_acceptes: 0,
      } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create.nombre_d_animaux_acceptes).toBe(0);
  });

  test('uses the existing carcasse numero_bracelet, not anything from body', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce({
      ...baseCarcasse,
      numero_bracelet: 'BR-FROM-DB',
    });
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      {
        ...baseCi,
        numero_bracelet: 'BR-FROM-BODY-IGNORED',
      } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create.numero_bracelet).toBe('BR-FROM-DB');
  });
});

describe("syncCarcasseIntermediaire — identité de l'intermédiaire", () => {
  test("intermediaire_user_id du body est ignoré au profit de l'utilisateur courant", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      { ...baseCi, intermediaire_user_id: 'user-victime' } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create.intermediaire_user_id).toBe('user-etg');
  });

  test("une entité dont l'utilisateur n'est pas membre → throws", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);

    await expect(
      syncCarcasseIntermediaire(
        'FEI-1',
        'INT-1',
        'ZC-1',
        { ...baseCi, intermediaire_entity_id: 'entity-autrui' } as any,
        etgUser
      )
    ).rejects.toThrow('Vous ne pouvez pas agir au nom de cette entité');
    expect(prisma.carcasseIntermediaire.upsert).not.toHaveBeenCalled();
  });

  test('intermediaire_entity_id vide → throws', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);

    await expect(
      syncCarcasseIntermediaire(
        'FEI-1',
        'INT-1',
        'ZC-1',
        { ...baseCi, intermediaire_entity_id: '' } as any,
        etgUser
      )
    ).rejects.toThrow('Vous ne pouvez pas agir au nom de cette entité');
  });

  // Un ETG enregistre l'étape de transport du collecteur : le rôle porté par l'enregistrement
  // n'est pas celui de l'utilisateur qui l'écrit.
  test("un rôle différent de celui de l'utilisateur est accepté", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-1',
      'INT-1',
      'ZC-1',
      { ...baseCi, intermediaire_role: 'COLLECTEUR_PRO' } as any,
      etgUser
    );

    const upsertCall = vi.mocked(prisma.carcasseIntermediaire.upsert).mock.calls[0][0];
    expect(upsertCall.create.intermediaire_role).toBe('COLLECTEUR_PRO');
  });
});
