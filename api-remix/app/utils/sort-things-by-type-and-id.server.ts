import {
  EntityTypes,
  EntityRelations,
  UserRelations,
  UserRoles,
  type Entity,
  type User,
  UserRelationType,
} from "@prisma/client";

type EntitiesById = Record<Entity["id"], Entity>;
type EntitiesByTypeAndId = Record<EntityTypes, EntitiesById>;

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
  entities: Array<EntityRelations>,
  entitiesById: EntitiesById
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

type PartialUser = Pick<User, "id" | "roles" | "prenom" | "nom_de_famille" | "code_postal" | "ville">;
type UsersById = Record<User["id"], PartialUser>;
export type AllowedRoles = typeof UserRoles.PREMIER_DETENTEUR | typeof UserRoles.EXAMINATEUR_INITIAL;
type UsersByRoleAndId = {
  [K in AllowedRoles]: UsersById;
};

export function sortUsersByRoleAndId(users: Array<PartialUser>): [UsersById, UsersByRoleAndId] {
  const allUsersIds: UsersById = {};
  const allUsersByRoleAndId: UsersByRoleAndId = {
    [UserRoles.PREMIER_DETENTEUR]: {},
    [UserRoles.EXAMINATEUR_INITIAL]: {},
  };

  for (const user of users) {
    allUsersIds[user.id] = user;
    if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      allUsersByRoleAndId[UserRoles.PREMIER_DETENTEUR][user.id] = user;
    }
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      allUsersByRoleAndId[UserRoles.EXAMINATEUR_INITIAL][user.id] = user;
    }
  }

  return [allUsersIds, allUsersByRoleAndId];
}

export function sortUsersRelationsByRoleAndId(
  userRelations: Array<UserRelations>,
  usersById: UsersById
): UsersByRoleAndId {
  const usersByRoleAndId: UsersByRoleAndId = {
    [UserRoles.PREMIER_DETENTEUR]: {},
    [UserRoles.EXAMINATEUR_INITIAL]: {},
  };
  for (const userRelation of userRelations) {
    const user = usersById[userRelation.related_id];
    if (user) {
      if (
        userRelation.relation === UserRelationType.PREMIER_DETENTEUR &&
        user.roles.includes(UserRoles.PREMIER_DETENTEUR)
      ) {
        usersByRoleAndId[UserRoles.PREMIER_DETENTEUR][user.id] = user;
      }
      if (
        userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL &&
        user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)
      ) {
        usersByRoleAndId[UserRoles.EXAMINATEUR_INITIAL][user.id] = user;
      }
    }
  }
  return usersByRoleAndId;
}
