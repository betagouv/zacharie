import { describe, test, expect, vi, beforeEach } from 'vitest';
import { isStaleWrite } from '~/utils/sync-version';
import { syncCarcasse } from '~/utils/sync-carcasse';
import { SyncRejectedError } from '~/utils/sync-errors';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { fakeSyncScope } from './fake-sync-scope';

const etg = { id: 'user-etg', roles: [UserRoles.ETG], activated: true } as unknown as User;
const svi = { id: 'user-svi', roles: [UserRoles.SVI], activated: true } as unknown as User;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isStaleWrite', () => {
  test("une version inférieure, dépassée par l'écriture d'un autre utilisateur → périmée", () => {
    expect(isStaleWrite({ version: 3, version_user_id: svi.id }, 2, etg)).toBe(true);
  });

  test('la même version que la base → acceptée', () => {
    expect(isStaleWrite({ version: 3, version_user_id: svi.id }, 3, etg)).toBe(false);
  });

  // `syncData` annule côté client la requête en cours quand une nouvelle part, mais le serveur la
  // traite : la requête suivante du même utilisateur arrive avec une version qu'il a lui-même dépassée.
  test('une version inférieure, dépassée par sa propre écriture → acceptée', () => {
    expect(isStaleWrite({ version: 3, version_user_id: etg.id }, 2, etg)).toBe(false);
  });

  test('une écriture serveur sans utilisateur (cron) rend périmée toute version antérieure', () => {
    expect(isStaleWrite({ version: 3, version_user_id: null }, 2, etg)).toBe(true);
  });

  test('sans version envoyée → version initiale', () => {
    expect(isStaleWrite({ version: 0, version_user_id: null }, undefined, etg)).toBe(false);
    expect(isStaleWrite({ version: 1, version_user_id: svi.id }, undefined, etg)).toBe(true);
  });
});

describe('syncCarcasse — version périmée', () => {
  const fei = { numero: 'FEI-1', deleted_at: null } as any;
  const carcasse = {
    zacharie_carcasse_id: 'ZC-1',
    fei_numero: 'FEI-1',
    numero_bracelet: 'BR-1',
    version: 3,
    version_user_id: svi.id,
  } as any;

  test("refuse l'écriture et touche updated_at pour que le client recharge la version à jour", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(fei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasse);

    await expect(
      syncCarcasse('FEI-1', 'ZC-1', { fei_numero: 'FEI-1', version: 2 } as any, etg, fakeSyncScope())
    ).rejects.toThrow(new SyncRejectedError('Version obsolète'));

    expect(prisma.carcasse.update).toHaveBeenCalledOnce();
    expect(prisma.carcasse.update).toHaveBeenCalledWith({
      where: { zacharie_carcasse_id: 'ZC-1' },
      data: { updated_at: expect.any(Date) },
    });
  });

  test('une version à jour est écrite, et le serveur incrémente la version', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(fei);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(carcasse);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce(carcasse);

    await syncCarcasse('FEI-1', 'ZC-1', { fei_numero: 'FEI-1', version: 3 } as any, etg, fakeSyncScope());

    expect(vi.mocked(prisma.carcasse.update).mock.calls[0][0].data).toMatchObject({
      version: { increment: 1 },
      version_user_id: etg.id,
    });
  });
});
