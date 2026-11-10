import { EntityRelationType, EntityTypes } from '@prisma/client';
import prisma from '~/prisma';

export const MAX_ASSOCIATIONS_DE_CHASSE = 5;

export const MAX_ASSOCIATIONS_DE_CHASSE_ERROR = `Vous ne pouvez pas être rattaché à plus de ${MAX_ASSOCIATIONS_DE_CHASSE} associations de chasse.`;

// les demandes en attente comptent : sinon un chasseur pourrait en demander autant qu'il veut
export async function hasReachedMaxAssociationsDeChasse(userId: string) {
  const count = await prisma.entityAndUserRelations.count({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.PREMIER_DETENTEUR, deleted_at: null },
    },
  });
  return count >= MAX_ASSOCIATIONS_DE_CHASSE;
}
