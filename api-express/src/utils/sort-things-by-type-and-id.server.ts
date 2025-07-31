import {
  EntityTypes,
  EntityAndUserRelations,
  UserRelations,
  UserRoles,
  type Entity,
  type User,
  UserRelationType,
} from '@prisma/client';
import type { EntitiesById, EntitiesByTypeAndId } from '~/types/entity';

export function sortEntitiesByTypeAndId(entities: Array<Entity>): [EntitiesById, EntitiesByTypeAndId] {
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
  entities: Array<EntityAndUserRelations>,
  entitiesById: EntitiesById,
): EntitiesByTypeAndId {
  const entitiesByTypeAndId: EntitiesByTypeAndId = Object.values(EntityTypes).reduce((acc, type) => {
    acc[type] = {};
    return acc;
  }, {} as EntitiesByTypeAndId);
  for (const entityRelation of entities) {
    const entity = entitiesById[entityRelation.entity_id];
    if (entity) {
      if (!entitiesByTypeAndId[entity.type][entity.id]) {
        entitiesByTypeAndId[entity.type][entity.id] = entity;
      }
    }
  }
  return entitiesByTypeAndId;
}
