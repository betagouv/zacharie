import { type Entity } from '@prisma/client';

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
