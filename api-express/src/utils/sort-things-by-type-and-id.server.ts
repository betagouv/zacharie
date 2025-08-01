import {
  EntityTypes,
  EntityAndUserRelations,
  UserRelations,
  UserRoles,
  type Entity,
  type User,
  UserRelationType,
} from '@prisma/client';
import type { EntitiesById, EntitiesByTypeAndId, EntityWithUserRelations } from '~/types/entity';

export function sortEntitiesByTypeAndId(
  entities: Array<EntityWithUserRelations>,
): [EntitiesById, EntitiesByTypeAndId] {
  const allEntitiesIds: EntitiesById = {};
  const allEntitiesByTypeAndId: EntitiesByTypeAndId = Object.values(EntityTypes).reduce((acc, type) => {
    acc[type] = {};
    return acc;
  }, {} as EntitiesByTypeAndId);

  for (const entity of entities) {
    allEntitiesIds[entity.id] = entity;
    allEntitiesByTypeAndId[entity.type][entity.id] = entity;
  }

  return [allEntitiesIds, allEntitiesByTypeAndId];
}

export function sortEntitiesRelationsByTypeAndId(
  entities: Array<EntityWithUserRelations>,
  entitiesById: EntitiesById,
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
