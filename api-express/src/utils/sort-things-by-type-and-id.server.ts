import { EntityTypes } from '@prisma/client';
import type { EntitiesByTypeAndId, EntityWithUserRelations } from '~/types/entity';

export function sortEntitiesByTypeAndId(entities: Array<EntityWithUserRelations>): EntitiesByTypeAndId {
  const allEntitiesByTypeAndId: EntitiesByTypeAndId = Object.values(EntityTypes).reduce((acc, type) => {
    acc[type] = {};
    return acc;
  }, {} as EntitiesByTypeAndId);

  for (const entity of entities) {
    allEntitiesByTypeAndId[entity.type][entity.id] = entity;
  }

  return allEntitiesByTypeAndId;
}

export function sortEntitiesRelationsByTypeAndId(
  entities: Array<EntityWithUserRelations>
): EntitiesByTypeAndId {
  const entitiesByTypeAndId: EntitiesByTypeAndId = Object.values(EntityTypes).reduce((acc, type) => {
    acc[type] = {};
    return acc;
  }, {} as EntitiesByTypeAndId);
  for (const entityWithUserRelations of entities) {
    if (entityWithUserRelations) {
      if (!entitiesByTypeAndId[entityWithUserRelations.type][entityWithUserRelations.id]) {
        entitiesByTypeAndId[entityWithUserRelations.type][entityWithUserRelations.id] =
          entityWithUserRelations;
      }
    }
  }
  return entitiesByTypeAndId;
}
