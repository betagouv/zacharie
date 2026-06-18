import useUser from '@app/zustand/user';
import { EntityTypes, Entity, User, UserRoles } from '@prisma/client';

export function isRoleCircuitCourt(role: UserRoles) {
  if (!role) return false;
  return (
    role === UserRoles.COMMERCE_DE_DETAIL ||
    role === UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF ||
    role === UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE ||
    role === UserRoles.ASSOCIATION_CARITATIVE ||
    role === UserRoles.CONSOMMATEUR_FINAL
  );
}

export function isCircuitCourt(user: User) {
  if (!user) return false;
  return isRoleCircuitCourt(user.roles[0]);
}

export function isEntityCircuitCourt(entity: Entity) {
  if (!entity) return false;
  return (
    entity.type === EntityTypes.COMMERCE_DE_DETAIL ||
    entity.type === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ||
    entity.type === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ||
    entity.type === EntityTypes.ASSOCIATION_CARITATIVE ||
    entity.type === EntityTypes.CONSOMMATEUR_FINAL
  );
}

export function useIsCircuitCourt() {
  const user = useUser((state) => state.user)!;
  return isCircuitCourt(user);
}
