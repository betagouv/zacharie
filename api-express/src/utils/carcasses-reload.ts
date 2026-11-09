import { EntityRelationStatus, EntityRelationType } from '@prisma/client';
import type { EntityAndUserRelations, User } from '@prisma/client';
import prisma from '~/prisma';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

type RelationScope = Pick<EntityAndUserRelations, 'owner_id' | 'relation' | 'status'> | null | undefined;

// Même définition d'appartenance que getUserCarcasseEntityIds (périmètre carcasses).
function givesCarcassesAccess(relation: RelationScope) {
  return (
    relation?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
    (relation.status === EntityRelationStatus.ADMIN || relation.status === EntityRelationStatus.MEMBER)
  );
}

// Le pull delta /carcasse ne renvoie que les carcasses modifiées depuis le dernier pull : quand un
// utilisateur entre dans une entité, les carcasses déjà existantes de l'entité ne lui arrivent jamais ;
// quand il en sort, ses copies locales restent. On demande donc à tous ses appareils un rechargement
// complet. Le curseur de chaque appareil est comparé à cette date (cf. getFullReloadAfter), pas de
// remise à zéro : chaque appareil recharge une fois.
export async function requestCarcassesReload(userId: User['id']) {
  await prisma.user.update({
    where: { id: userId },
    data: { carcasses_reload_requested_at: new Date() },
  });
}

// À appeler après chaque création / modification / suppression d'une EntityAndUserRelations, avec
// la relation avant (null si création) et après (null si suppression).
export async function requestCarcassesReloadIfAccessChanged(before: RelationScope, after: RelationScope) {
  const ownerIds = new Set<string>();
  if (givesCarcassesAccess(before) !== givesCarcassesAccess(after)) {
    if (before) ownerIds.add(before.owner_id);
    if (after) ownerIds.add(after.owner_id);
  } else if (givesCarcassesAccess(before) && before!.owner_id !== after!.owner_id) {
    ownerIds.add(before!.owner_id);
    ownerIds.add(after!.owner_id);
  }
  for (const ownerId of ownerIds) {
    await requestCarcassesReload(ownerId);
  }
}

// Un curseur antérieur à cette date déclenche un rechargement complet du périmètre.
export function getFullReloadAfter(user: Pick<User, 'carcasses_reload_requested_at'>): Date {
  if (!user.carcasses_reload_requested_at) return FORCE_FULL_RELOAD_AFTER;
  const requestedAt = new Date(user.carcasses_reload_requested_at);
  return requestedAt > FORCE_FULL_RELOAD_AFTER ? requestedAt : FORCE_FULL_RELOAD_AFTER;
}
