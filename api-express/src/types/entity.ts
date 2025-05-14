import type { Prisma, Entity, EntityTypes } from '@prisma/client';

export type EntityWithUserRelationType =
  | 'WORKING_FOR_ENTITY_RELATED_WITH'
  | 'NONE'
  | 'WORKING_FOR'
  | 'WORKING_WITH';

export interface EntityWithUserRelation extends Entity {
  relation: EntityWithUserRelationType;
}

export interface ETGWithEntityIdsRelated extends Entity {
  entitiesRelated: Array<{
    entity_id: Entity['id'];
    entity_type: Entity['type'];
  }>;
}

export type EntitiesById = Record<Entity['id'], Entity>;
export type EntitiesByTypeAndId = Record<EntityTypes, EntitiesById>;

export const entityAdminInclude = {
  EntityRelationsWithUsers: {
    select: {
      relation: true,
      UserRelatedWithEntity: {
        select: {
          id: true,
          email: true,
          nom_de_famille: true,
          prenom: true,
          code_postal: true,
          ville: true,
          roles: true,
        },
      },
    },
  },
} as const;

export type EntityForAdmin = Prisma.EntityGetPayload<{
  include: typeof entityAdminInclude;
}>;

export const etgAdminInclude = {
  AsEtgRelationsWithOtherEntities: true,
} as const;

export type EtgForAdmin = Prisma.EntityGetPayload<{
  include: typeof etgAdminInclude;
}>;
