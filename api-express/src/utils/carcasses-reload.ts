import type { User } from '@prisma/client';
import prisma from '~/prisma';

export async function requestCarcassesReload(userId: User['id']) {
  return prisma.user.update({
    where: { id: userId },
    data: { carcasses_reload_version: { increment: 1 } },
  });
}
