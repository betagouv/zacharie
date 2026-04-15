import useUser from '@app/zustand/user';
import { User, UserRoles } from '@prisma/client';

export function isCircuitCourt(user: User) {
  if (!user) return false;
  return (
    user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) ||
    user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) ||
    user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) ||
    user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) ||
    user.roles.includes(UserRoles.CONSOMMATEUR_FINAL)
  );
}

export function useIsCircuitCourt() {
  const user = useUser((state) => state.user)!;
  return isCircuitCourt(user);
}
