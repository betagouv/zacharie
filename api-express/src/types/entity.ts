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
