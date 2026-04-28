import {
  EntityTypes,
  EntityAndUserRelations,
  UserRelations,
  UserRoles,
  type Entity,
  type User,
  UserRelationType,
} from '@prisma/client';
import type {
  EntitiesById,
  EntitiesByTypeAndId,
  EntityWithUserRelations,
  OperationalEntityType,
} from '~/types/entity';
import { NON_OPERATIONAL_ENTITY_TYPES } from '~/types/entity';

const isOperational = (type: EntityTypes): type is OperationalEntityType =>
  !(NON_OPERATIONAL_ENTITY_TYPES as readonly EntityTypes[]).includes(type);

const emptyEntitiesByTypeAndId = (): EntitiesByTypeAndId =>
  Object.values(EntityTypes)
    .filter(isOperational)
    .reduce((acc, type) => {
      acc[type] = {};
      return acc;
    }, {} as EntitiesByTypeAndId);

export function sortEntitiesByTypeAndId(
  entities: Array<EntityWithUserRelations>
): [EntitiesById, EntitiesByTypeAndId] {
  const allEntitiesIds: EntitiesById = {};
  const allEntitiesByTypeAndId = emptyEntitiesByTypeAndId();

  for (const entity of entities) {
    if (!isOperational(entity.type)) continue;
    allEntitiesIds[entity.id] = entity;
    allEntitiesByTypeAndId[entity.type][entity.id] = entity;
  }

  return [allEntitiesIds, allEntitiesByTypeAndId];
}

export function sortEntitiesRelationsByTypeAndId(
  entities: Array<EntityWithUserRelations>,
  entitiesById: EntitiesById
): EntitiesByTypeAndId {
  const entitiesByTypeAndId = emptyEntitiesByTypeAndId();
  for (const entityWithUserRelations of entities) {
    if (!entityWithUserRelations) continue;
    if (!isOperational(entityWithUserRelations.type)) continue;
    if (!entitiesByTypeAndId[entityWithUserRelations.type][entityWithUserRelations.id]) {
      entitiesByTypeAndId[entityWithUserRelations.type][entityWithUserRelations.id] = entityWithUserRelations;
    }
  }
  return entitiesByTypeAndId;
}
