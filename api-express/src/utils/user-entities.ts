import { EntityRelationStatus, EntityRelationType, EntityTypes } from '@prisma/client';
import prisma from '~/prisma';
import type { User } from '@prisma/client';

// Entités pour lesquelles l'utilisateur peut manipuler des carcasses. Sert à la fois au périmètre
// de lecture (`getCarcasseAccessWhere`) et au contrôle d'écriture des CarcasseIntermediaire, pour
// que les deux reposent sur exactement la même définition d'appartenance.
export async function getUserCarcasseEntityIds(userId: User['id']): Promise<Array<string>> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
    },
    select: { entity_id: true },
  });
  return relations.map((relation) => relation.entity_id);
}

// CCG dont l'utilisateur est propriétaire (statut ADMIN), quel que soit son rôle : il lit les fiches
// déposées dans ces CCG jusqu'à leur sortie du CCG, sans leur statut (cf `ccg-read-only.ts`).
export async function getUserAdminCcgIds(userId: User['id']): Promise<Array<string>> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      status: EntityRelationStatus.ADMIN,
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.CCG, deleted_at: null },
    },
    select: { entity_id: true },
  });
  return relations.map((relation) => relation.entity_id);
}
