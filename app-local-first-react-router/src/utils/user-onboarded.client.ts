import { User, UserRoles } from '@prisma/client';

export function getUserOnboardingRoute(user: User): string | null {
  if (user.onboarded_at) {
    return null;
  }
  if (user.roles.filter((role) => role !== UserRoles.ADMIN).length > 0) {
    return '/app/tableau-de-bord/mon-profil/mes-coordonnees';
  }
  return '/app/tableau-de-bord/mon-profil/mon-activite';
}
