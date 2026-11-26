import { describe, test, expect, vi, beforeEach } from 'vitest';
import { FeiOwnerRole, UserRoles } from '@prisma/client';
import type { Carcasse, User } from '@prisma/client';
import { syncCarcasse } from '~/utils/sync-carcasse';
import prisma from '~/prisma';
import { fakeSyncScope } from './fake-sync-scope';

// Une nouvelle carcasse est écrite en une seule fois, colonnes de rattachement comprises : si cette
// écriture échoue, aucune ligne nue (hors du périmètre de tout le monde) ne reste en base, et le
// renvoi suivant crée la carcasse normalement. La table Carcasse est simulée en mémoire.

const chasseur = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const fei = {
  numero: 'FEI-1',
  deleted_at: null,
  examinateur_initial_user_id: chasseur.id,
  premier_detenteur_user_id: chasseur.id,
} as any;

const body = {
  fei_numero: 'FEI-1',
  zacharie_carcasse_id: 'ZC-NEW',
  numero_bracelet: 'BR-NEW',
  examinateur_initial_user_id: chasseur.id,
  current_owner_user_id: chasseur.id,
  current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
} as any;

let table: Map<string, Carcasse>;

beforeEach(() => {
  vi.clearAllMocks();
  table = new Map();
  vi.mocked(prisma.carcasse.findFirst).mockReset();
  vi.mocked(prisma.carcasse.findFirst).mockImplementation((async (args: any) => {
    const row = table.get(args.where.zacharie_carcasse_id);
    return row && row.fei_numero === args.where.fei_numero ? row : null;
  }) as any);
  vi.mocked(prisma.carcasse.create).mockReset();
  vi.mocked(prisma.carcasse.create).mockImplementation((async (args: any) => {
    const row = { ...args.data } as Carcasse;
    table.set(row.zacharie_carcasse_id, row);
    return row;
  }) as any);
  vi.mocked(prisma.carcasse.update).mockReset();
});

function sync() {
  return syncCarcasse('FEI-1', 'ZC-NEW', body, chasseur, fakeSyncScope(), { existingFei: fei });
}

describe('syncCarcasse — création atomique', () => {
  test("un échec de l'écriture ne laisse aucune ligne nue, et le renvoi crée la carcasse", async () => {
    vi.mocked(prisma.carcasse.create).mockRejectedValueOnce(new Error('connexion perdue'));

    await expect(sync()).rejects.toThrow('connexion perdue');
    expect(table.size).toBe(0);
    expect(prisma.carcasse.update).not.toHaveBeenCalled();

    const { savedCarcasse } = await sync();

    expect(table.get('ZC-NEW')).toBe(savedCarcasse);
    expect(savedCarcasse).toMatchObject({
      zacharie_carcasse_id: 'ZC-NEW',
      fei_numero: 'FEI-1',
      numero_bracelet: 'BR-NEW',
      created_by_user_id: chasseur.id,
      examinateur_initial_user_id: chasseur.id,
      current_owner_user_id: chasseur.id,
      current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      version: 1,
      version_user_id: chasseur.id,
    });
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test('la carcasse créée entre dans le périmètre de la requête seulement une fois écrite', async () => {
    const grant = vi.fn();
    vi.mocked(prisma.carcasse.create).mockRejectedValueOnce(new Error('connexion perdue'));

    await expect(
      syncCarcasse('FEI-1', 'ZC-NEW', body, chasseur, fakeSyncScope({ grant }), { existingFei: fei })
    ).rejects.toThrow();
    expect(grant).not.toHaveBeenCalled();

    await syncCarcasse('FEI-1', 'ZC-NEW', body, chasseur, fakeSyncScope({ grant }), { existingFei: fei });
    expect(grant).toHaveBeenCalledWith('ZC-NEW');
  });
});
