import type { User } from '@prisma/client';
import prisma from '~/prisma';

// Le pull delta /carcasse ne renvoie que les carcasses modifiées depuis le dernier pull : quand un
// utilisateur entre dans une entité, les carcasses déjà existantes de l'entité ne lui arrivent jamais ;
// quand il en sort, ses copies locales restent. Chaque écriture d'une relation
// CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY appelle donc ce helper : chaque appareil qui envoie une version
// inférieure recharge tout son périmètre, une fois.
export async function requestCarcassesReload(userId: User['id']) {
  return prisma.user.update({
    where: { id: userId },
    data: { carcasses_reload_version: { increment: 1 } },
  });
}
