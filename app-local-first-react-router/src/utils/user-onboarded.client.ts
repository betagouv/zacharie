import { User, UserRoles } from '@prisma/client';

export function getUserOnboardingRoute(user: User): string {
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (user.onboarded_at) {
      return '/app/chasseur';
    }
    return '/app/chasseur/onboarding/mes-coordonnees';
  }
  if (user.roles.includes(UserRoles.ETG)) {
    if (user.onboarded_at) {
      return '/app/etg';
    }
    return '/app/etg/onboarding/coordonnees';
  }
  if (user.onboarded_at) {
    return '/app/tableau-de-bord';
  }
  if (user.roles.length > 0) {
    return '/app/tableau-de-bord/onboarding/mes-coordonnees';
  }
  return '/app/tableau-de-bord/onboarding/mon-activite';
}
