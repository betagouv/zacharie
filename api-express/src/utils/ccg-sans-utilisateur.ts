import { type Entity, EntityRelationType, EntityTypes } from '@prisma/client';
import prisma from '~/prisma';

// un CCG pré-enregistré dont plus personne ne se sert n'a plus de créateur pour le modifier :
// le chasseur qui s'y rattache en devient le créateur
export async function isPreregisteredCCGWithoutUser(entity: Entity) {
  if (entity.type !== EntityTypes.CCG || entity.ccg_status !== 'Pré-enregistré dans Zacharie') return false;
  const users = await prisma.entityAndUserRelations.count({
    where: {
      entity_id: entity.id,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    },
  });
  return users === 0;
}
