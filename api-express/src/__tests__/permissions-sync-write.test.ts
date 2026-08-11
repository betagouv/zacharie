import { describe, test, expect, vi, beforeEach } from 'vitest';
import { UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import prisma from '~/prisma';
import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// Cloisonnement en écriture (lot 3 de l'audit) : avant, tout compte activé pouvait écraser la
// fiche, la carcasse ou l'intermédiaire d'un tiers en connaissant son identifiant. Ces tests
// exercent le vrai `carcasse-access` (pas de mock) contre un prisma mocké.

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
      syncFei('FEI-VICTIME', { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Hacked' } as any, attaquant)
    ).rejects.toThrow("Vous n'avez pas accès à cette fiche");

    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test("l'examinateur initial de la fiche peut la modifier", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(feiTierce);

    await syncFei(
      'FEI-VICTIME',
      { numero: 'FEI-VICTIME', commune_mise_a_mort: 'Ma commune' } as any,
      proprietaire
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
      attaquant
    );

    expect(prisma.fei.update).toHaveBeenCalled();
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
        attaquant
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
      attaquant
    );

    expect(prisma.carcasse.update).toHaveBeenCalled();
  });

  // Le lot pré-calculé est un instantané : une carcasse créée entre-temps par une requête de sync
  // concurrente n'y figure pas. Refuser sur cette seule base rejetterait une écriture légitime.
  test('un instantané de lot périmé ne suffit pas à refuser : on revérifie en base', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([{ zacharie_carcasse_id: 'ZC-VICTIME' }] as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasseTierce);

    await syncCarcasse(
      'FEI-VICTIME',
      'ZC-VICTIME',
      { fei_numero: 'FEI-VICTIME', heure_evisceration: '15:00' } as any,
      attaquant,
      { accessibleCarcasseIds: new Set(), userEntityIds: ['entity-etg-2'] }
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
        attaquant
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
      proprietaire
    );

    expect(prisma.carcasse.create).toHaveBeenCalled();
  });

  test('la suppression est soumise au même périmètre', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(feiTierce);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasseTierce);

    await expect(
      syncCarcasse(
        'FEI-VICTIME',
        'ZC-VICTIME',
        { fei_numero: 'FEI-VICTIME', deleted_at: new Date() } as any,
        attaquant
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
        attaquant
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
      attaquant
    );

    expect(prisma.carcasseIntermediaire.upsert).toHaveBeenCalled();
  });
});
