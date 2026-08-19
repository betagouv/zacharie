import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  FeiOwnerRole,
  UserRoles,
} from '@prisma/client';
import type { User } from '@prisma/client';
import prisma from '~/prisma';
import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import { syncCarcasseModifRequest } from '~/utils/sync-carcasse-modification-request';
import { createSyncScope } from '~/utils/sync-scope';

// Cloisonnement en écriture (lot 3 de l'audit) : avant, tout compte activé pouvait écraser la
// fiche, la carcasse ou l'intermédiaire d'un tiers en connaissant son identifiant. Ces tests
// construisent un vrai `SyncScope` (pas de mock) contre un prisma mocké.

const attaquant = {
  id: 'user-etg-2',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const proprietaire = {
  id: 'user-chasseur-1',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

// Fiche d'un tiers : ni créée, ni examinée, ni détenue par l'attaquant.
const feiTierce = {
  numero: 'FEI-VICTIME',
  deleted_at: null,
  created_by_user_id: proprietaire.id,
  examinateur_initial_user_id: proprietaire.id,
  premier_detenteur_user_id: proprietaire.id,
  premier_detenteur_entity_id: 'entity-asso',
} as any;

const carcasseTierce = {
  zacharie_carcasse_id: 'ZC-VICTIME',
  fei_numero: 'FEI-VICTIME',
  numero_bracelet: 'BR-VICTIME',
  deleted_at: null,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  // L'attaquant appartient bien à une entité — ce n'est pas ce qui doit le bloquer.
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-etg-2' }] as any);
  // Aucune carcasse de la fiche tierce n'est dans son périmètre.
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(0);
});

describe('syncFei — écriture sur une fiche tierce', () => {
  test('un utilisateur sans lien avec la fiche ne peut pas la modifier', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);

    await expect(
      syncFei(
        'FEI-VICTIME',
        { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Hacked' } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette fiche");

    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test("l'examinateur initial de la fiche peut la modifier", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Ma commune' } as any,
      proprietaire,
      await createSyncScope(proprietaire)
    );

    expect(prisma.fei.update).toHaveBeenCalled();
  });

  test('un détenteur suivant (≥1 carcasse dans son périmètre) peut la modifier', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.count).mockResolvedValue(3);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', resume_nombre_de_carcasses: '3' } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(prisma.fei.update).toHaveBeenCalled();
  });
});

describe("syncFei — asso désignée premier détenteur, fiche encore chez l'examinateur", () => {
  // Le périmètre de lecture n'ouvre la fiche aux membres de l'asso désignée qu'une fois celle-ci
  // sortie de l'examinateur initial (`current_owner_role != EXAMINATEUR_INITIAL` dans
  // `getCarcasseAccessWhere`). L'écriture doit s'aligner : la désignation seule ne suffit pas.
  const membreAsso = {
    id: 'user-asso',
    roles: [UserRoles.CHASSEUR],
    activated: true,
    isZacharieAdmin: false,
  } as unknown as User;

  beforeEach(() => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { entity_id: 'entity-asso' },
    ] as any);
  });

  test('désignée mais pas encore transmise : aucune carcasse dans le périmètre → écriture refusée', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    // La fiche est encore chez l'examinateur : le WHERE de lecture ne matche aucune carcasse.
    vi.mocked(prisma.carcasse.count).mockResolvedValue(0);

    await expect(
      syncFei(
        'FEI-VICTIME',
        { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Hacked' } as any,
        membreAsso,
        await createSyncScope(membreAsso)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette fiche");

    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test('une fois la fiche transmise, ses carcasses entrent dans le périmètre → écriture permise', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.count).mockResolvedValue(4);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Villette' } as any,
      membreAsso,
      await createSyncScope(membreAsso)
    );

    expect(prisma.fei.update).toHaveBeenCalled();
    // Le décompte porte bien la condition de sortie de l'examinateur initial.
    const countArgs = vi.mocked(prisma.carcasse.count).mock.calls[0][0];
    expect(countArgs?.where).toMatchObject({
      fei_numero: 'FEI-VICTIME',
      OR: expect.arrayContaining([
        expect.objectContaining({
          premier_detenteur_entity_id: { in: ['entity-asso'] },
          current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
        }),
      ]),
    });
  });

  test('la désignation ne donne pas non plus la main sur les colonnes de rattachement', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.count).mockResolvedValue(4);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', premier_detenteur_user_id: membreAsso.id } as any,
      membreAsso,
      await createSyncScope(membreAsso)
    );

    const updateArgs = vi.mocked(prisma.fei.update).mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty('premier_detenteur_user_id');
  });
});

describe('syncFei — auto-attribution des colonnes de rattachement', () => {
  // `canWriteFei` accorde l'écriture sur ces colonnes-là : un détenteur aval qui les réécrit se
  // donne un accès à la fiche que la fin du circuit ne lui retirera plus.
  test("un détenteur aval ne peut pas s'inscrire comme premier détenteur", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    // Il détient une carcasse de la fiche : c'est par là qu'il obtient le droit d'écrire.
    vi.mocked(prisma.carcasse.count).mockResolvedValue(1);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      {
        numero: 'FEI-VICTIME',
        commune_mise_a_mort: 'Villette',
        premier_detenteur_entity_id: 'entity-etg-2',
        premier_detenteur_name_cache: 'ETG 2',
      } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    // Le reste de la fiche est bien écrit, seules les colonnes de rattachement sont ignorées — dont
    // le name cache, qui est la valeur affichée partout dans l'app.
    const updateArgs = vi.mocked(prisma.fei.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({ commune_mise_a_mort: 'Villette' });
    expect(updateArgs.data).not.toHaveProperty('premier_detenteur_entity_id');
    expect(updateArgs.data).not.toHaveProperty('premier_detenteur_name_cache');
  });

  test('renvoyer ces colonnes inchangées ne bloque pas la synchro', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.count).mockResolvedValue(1);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      {
        numero: 'FEI-VICTIME',
        resume_nombre_de_carcasses: '1',
        premier_detenteur_entity_id: 'entity-asso',
        examinateur_initial_user_id: proprietaire.id,
      } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(prisma.fei.update).toHaveBeenCalled();
  });

  test('le premier détenteur désigné, lui, peut les modifier', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', premier_detenteur_user_id: proprietaire.id } as any,
      proprietaire,
      await createSyncScope(proprietaire)
    );

    expect(prisma.fei.update).toHaveBeenCalled();
  });
});

describe("syncCarcasse — auto-attribution de l'examen initial", () => {
  // `examinateur_initial_user_id` commande l'approbation des demandes de modification : se
  // l'attribuer revient à approuver ses propres demandes.
  test("un détenteur aval ne peut pas s'attribuer l'examen initial", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-VICTIME',
      { fei_numero: 'FEI-VICTIME', examinateur_initial_user_id: attaquant.id } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    // La colonne suit la fiche, pas le corps de la requête.
    const updateArgs = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({ examinateur_initial_user_id: proprietaire.id });
  });

  test('recopier la valeur de la fiche reste possible (carcasse manquante ajoutée à la réception)', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.count).mockResolvedValue(1);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce({
      ...carcasseTierce,
      examinateur_initial_user_id: null,
    } as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-VICTIME',
      {
        fei_numero: 'FEI-VICTIME',
        numero_bracelet: 'BR-VICTIME',
        examinateur_initial_user_id: proprietaire.id,
      } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(prisma.carcasse.update).toHaveBeenCalled();
  });
});

describe('syncCarcasse — écriture sur une carcasse tierce', () => {
  test('une carcasse hors périmètre ne peut pas être modifiée', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);

    await expect(
      syncCarcasse(
        'FEI-VICTIME',
        'ZC-VICTIME',
        { fei_numero: 'FEI-VICTIME', current_owner_entity_id: 'entity-etg-2' } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette carcasse");

    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test('une carcasse dans le périmètre reste modifiable', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-VICTIME',
      { fei_numero: 'FEI-VICTIME', heure_evisceration: '14:30' } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(prisma.carcasse.update).toHaveBeenCalled();
  });

  // Le périmètre ne mémorise que les accès accordés : une carcasse créée ou transmise plus tard
  // dans la même requête doit pouvoir y entrer, un refus mis en cache la bloquerait à tort.
  test('un refus antérieur dans la même requête ne fige pas le périmètre', async () => {
    const scope = await createSyncScope(attaquant);
    // Au moment du pré-chargement, la carcasse n'est pas encore dans le périmètre.
    await scope.prefetch(['ZC-VICTIME']);
    expect(await scope.canWriteCarcasse('ZC-VICTIME')).toBe(false);

    // Elle vient de lui être transmise par une écriture antérieure du même lot.
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-VICTIME',
      { fei_numero: 'FEI-VICTIME', heure_evisceration: '15:00' } as any,
      attaquant,
      scope
    );

    expect(prisma.carcasse.update).toHaveBeenCalled();
  });

  test('on ne peut pas créer une carcasse sur une fiche à laquelle on ne participe pas', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);

    await expect(
      syncCarcasse(
        'FEI-VICTIME',
        'ZC-NOUVELLE',
        { fei_numero: 'FEI-VICTIME', numero_bracelet: 'BR-NOUVEAU' } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette fiche");

    expect(prisma.carcasse.create).not.toHaveBeenCalled();
  });

  test("l'examinateur initial peut créer une carcasse sur sa fiche", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-NOUVELLE',
      { fei_numero: 'FEI-VICTIME', numero_bracelet: 'BR-NOUVEAU' } as any,
      proprietaire,
      await createSyncScope(proprietaire)
    );

    expect(prisma.carcasse.create).toHaveBeenCalled();
  });

  test('la carcasse créée entre immédiatement dans le périmètre de son créateur', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.create).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);
    // La ligne nue tout juste créée ne matche aucun périmètre : si le scope ne l'accordait pas de
    // lui-même, un update en échec la rendrait définitivement inaccessible à son propre créateur.
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);

    const scope = await createSyncScope(proprietaire);
    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-NOUVELLE',
      { fei_numero: 'FEI-VICTIME', numero_bracelet: 'BR-NOUVEAU' } as any,
      proprietaire,
      scope
    );

    await expect(scope.canWriteCarcasse('ZC-NOUVELLE')).resolves.toBe(true);
  });

  test('la suppression est soumise au même périmètre', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);

    await expect(
      syncCarcasse(
        'FEI-VICTIME',
        'ZC-VICTIME',
        { fei_numero: 'FEI-VICTIME', deleted_at: new Date() } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette carcasse");

    expect(prisma.carcasseIntermediaire.updateMany).not.toHaveBeenCalled();
  });
});

describe('syncCarcasseIntermediaire — écriture sur une carcasse tierce', () => {
  // C'était l'escalade la plus directe : créer une ligne d'intermédiaire à son propre nom sur une
  // carcasse tierce la faisait entrer dans le périmètre de lecture ETG/collecteur.
  test("on ne peut pas s'ajouter comme intermédiaire sur une carcasse hors périmètre", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);

    await expect(
      syncCarcasseIntermediaire(
        'FEI-VICTIME',
        'INT-1',
        'ZC-VICTIME',
        {
          fei_numero: 'FEI-VICTIME',
          zacharie_carcasse_id: 'ZC-VICTIME',
          intermediaire_id: 'INT-1',
          intermediaire_entity_id: 'entity-etg-2',
          intermediaire_role: UserRoles.ETG,
        } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette carcasse");

    expect(prisma.carcasseIntermediaire.upsert).not.toHaveBeenCalled();
  });

  test('une carcasse qui lui a été transmise reste traitable', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.carcasseIntermediaire.upsert).mockResolvedValueOnce({} as any);

    await syncCarcasseIntermediaire(
      'FEI-VICTIME',
      'INT-1',
      'ZC-VICTIME',
      {
        fei_numero: 'FEI-VICTIME',
        zacharie_carcasse_id: 'ZC-VICTIME',
        intermediaire_id: 'INT-1',
        intermediaire_entity_id: 'entity-etg-2',
        intermediaire_role: UserRoles.ETG,
      } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(prisma.carcasseIntermediaire.upsert).toHaveBeenCalled();
  });
});

describe('syncCarcasseModifRequest — demande de modification sur une carcasse tierce', () => {
  // Créer une demande sur une carcasse tierce écrivait sur sa ligne (bump d'updated_at) et
  // notifiait son examinateur initial, sans aucun contrôle de périmètre.
  test('un utilisateur hors périmètre ne peut pas créer de demande', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(null);

    await expect(
      syncCarcasseModifRequest(
        {
          id: 'mod-attaque',
          type: CarcasseModificationRequestType.BRACELET_RENAME,
          zacharie_carcasse_id: 'ZC-VICTIME',
          fei_numero: 'FEI-VICTIME',
          requested_by_user_id: attaquant.id,
          requested_by_entity_id: 'entity-etg-2',
          numero_bracelet_before: 'BR-VICTIME',
          numero_bracelet_after: 'BR-HACKED',
        } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette carcasse");

    expect(prisma.carcasseModificationRequest.create).not.toHaveBeenCalled();
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test('un utilisateur hors périmètre ne peut pas non plus modifier une demande existante', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce({
      id: 'mod-1',
      type: CarcasseModificationRequestType.BRACELET_RENAME,
      status: CarcasseModificationRequestStatus.PENDING,
      zacharie_carcasse_id: 'ZC-VICTIME',
      requested_by_user_id: proprietaire.id,
      deleted_at: null,
    } as any);

    await expect(
      syncCarcasseModifRequest(
        { id: 'mod-1', zacharie_carcasse_id: 'ZC-VICTIME', comment_intermediaire: 'hacked' } as any,
        attaquant,
        await createSyncScope(attaquant)
      )
    ).rejects.toThrow("Vous n'avez pas accès à cette carcasse");

    expect(prisma.carcasseModificationRequest.update).not.toHaveBeenCalled();
  });

  test('une carcasse qui lui a été transmise reste éligible à une demande', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce({ fei_numero: 'FEI-VICTIME' } as any);
    vi.mocked(prisma.carcasseModificationRequest.create).mockResolvedValueOnce({
      id: 'mod-ok',
      zacharie_carcasse_id: 'ZC-VICTIME',
    } as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({} as any);

    const result = await syncCarcasseModifRequest(
      {
        id: 'mod-ok',
        type: CarcasseModificationRequestType.BRACELET_RENAME,
        zacharie_carcasse_id: 'ZC-VICTIME',
        fei_numero: 'FEI-VICTIME',
        requested_by_user_id: attaquant.id,
        requested_by_entity_id: 'entity-etg-2',
        numero_bracelet_before: 'BR-VICTIME',
        numero_bracelet_after: 'BR-CORRIGE',
      } as any,
      attaquant,
      await createSyncScope(attaquant)
    );

    expect(result.isNew).toBe(true);
    expect(prisma.carcasseModificationRequest.create).toHaveBeenCalled();
  });
});
