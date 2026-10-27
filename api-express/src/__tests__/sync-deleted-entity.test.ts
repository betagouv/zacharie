import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { syncFei } from '~/utils/sync-fei';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { fakeSyncScope } from './fake-sync-scope';

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// Une entité supprimée par l'admin peut encore être proposée par la copie locale d'un chasseur :
// le sync refuse qu'une fiche ou une carcasse la désigne.
const scope = fakeSyncScope();

const chasseur = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-123',
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const baseFei = {
  numero: 'FEI-1',
  deleted_at: null,
  examinateur_initial_user_id: 'user-chasseur',
  premier_detenteur_user_id: 'user-chasseur',
  premier_detenteur_entity_id: null,
} as any;

const baseCarcasse = {
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: 'FEI-1',
  numero_bracelet: 'BR-1',
  next_owner_entity_id: null,
  premier_detenteur_depot_entity_id: null,
  premier_detenteur_entity_id: null,
} as any;

const REJECTION = 'Cette entité a été supprimée, choisissez-en une autre';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncCarcasse — entité supprimée', () => {
  test.each(['next_owner_entity_id', 'premier_detenteur_depot_entity_id', 'premier_detenteur_entity_id'])(
    '%s vers une entité supprimée → refusée, rien écrit',
    async (field) => {
      vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
      vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
      vi.mocked(prisma.entity.findMany).mockResolvedValueOnce([{ id: 'entity-deleted' }] as any);

      await expect(
        syncCarcasse(
          'FEI-1',
          'ZC-1',
          { fei_numero: 'FEI-1', [field]: 'entity-deleted' } as any,
          chasseur,
          scope
        )
      ).rejects.toThrow(REJECTION);

      expect(prisma.entity.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['entity-deleted'] }, deleted_at: { not: null } },
        select: { id: true },
      });
      expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
      expect(prisma.carcasse.update).not.toHaveBeenCalled();
    }
  );

  test('carcasse déjà transmise avant la suppression → continue de se synchroniser', async () => {
    const transmise = { ...baseCarcasse, next_owner_entity_id: 'entity-deleted' };
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(transmise);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({ id: 'rel' } as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(transmise);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', next_owner_entity_id: 'entity-deleted' } as any,
      chasseur,
      scope
    );

    expect(prisma.entity.findMany).not.toHaveBeenCalled();
    expect(prisma.carcasse.update).toHaveBeenCalled();
  });

  test('entités supprimées pré-chargées par le lot → aucune requête par carcasse', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);

    await expect(
      syncCarcasse(
        'FEI-1',
        'ZC-1',
        { fei_numero: 'FEI-1', next_owner_entity_id: 'entity-deleted' } as any,
        chasseur,
        scope,
        { deletedEntityIds: new Set(['entity-deleted']) }
      )
    ).rejects.toThrow(REJECTION);
    expect(prisma.entity.findMany).not.toHaveBeenCalled();
  });

  test('entité active → écrite normalement', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.entity.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({} as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(baseCarcasse);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { fei_numero: 'FEI-1', next_owner_entity_id: 'entity-active' } as any,
      chasseur,
      scope
    );

    expect(vi.mocked(prisma.carcasse.update).mock.calls[0][0].data.next_owner_entity_id).toBe(
      'entity-active'
    );
  });
});

describe('syncFei — entité supprimée', () => {
  test('premier détenteur = association supprimée → refusée, rien écrit', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.entity.findMany).mockResolvedValueOnce([{ id: 'asso-deleted' }] as any);

    await expect(
      syncFei(
        'FEI-1',
        { numero: 'FEI-1', premier_detenteur_entity_id: 'asso-deleted' } as any,
        chasseur,
        scope
      )
    ).rejects.toThrow(REJECTION);
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test('premier détenteur inchangé → la fiche se synchronise', async () => {
    const fei = { ...baseFei, premier_detenteur_entity_id: 'asso-deleted' };
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(fei);
    vi.mocked(prisma.fei.update).mockResolvedValueOnce(fei);

    await syncFei(
      'FEI-1',
      { numero: 'FEI-1', premier_detenteur_entity_id: 'asso-deleted' } as any,
      chasseur,
      scope
    );

    expect(prisma.entity.findMany).not.toHaveBeenCalled();
    expect(prisma.fei.update).toHaveBeenCalled();
  });
});
