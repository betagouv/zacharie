import type { Prisma, Entity, EntityTypes, EntityRelationType } from '@prisma/client';

export interface EntityWithUserRelation extends Entity {
  relation: EntityRelationType;
}

export interface ETGWithEntityIdsRelated extends Entity {
  entitiesRelated: Array<{
    entity_id: Entity['id'];
    entity_type: Entity['type'];
  }>;
}

export type EntitiesById = Record<Entity['id'], EntityWithUserRelations>;
export type EntitiesByTypeAndId = Record<EntityTypes, EntitiesById>;

export const entityAdminInclude = {
  EntityRelationsWithUsers: {
    select: {
      id: true,
      relation: true,
      status: true,
      owner_id: true,
      entity_id: true,
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

export type EntityWithUserRelations = Prisma.EntityGetPayload<{
  include: typeof entityAdminInclude;
}>;
