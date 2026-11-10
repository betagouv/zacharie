import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import { requestCarcassesReload } from '~/utils/carcasses-reload';

// Chaque écriture d'une EntityAndUserRelations incrémente User.carcasses_reload_version :
// tous les appareils de l'utilisateur rechargent leur périmètre une fois.

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestCarcassesReload', () => {
  test('incrémente la version de rechargement de l’utilisateur', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-1', carcasses_reload_version: 1 } as any);
    const savedUser = await requestCarcassesReload('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { carcasses_reload_version: { increment: 1 } },
    });
    expect(savedUser.carcasses_reload_version).toBe(1);
  });
});
