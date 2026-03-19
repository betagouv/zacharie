import { User } from '@prisma/client';

export function getUserOnboardingRoute(user: User): string | null {
  if (user.onboarded_at) {
    return null;
  }
  if (user.roles.length > 0) {
    return '/app/tableau-de-bord/onboarding/mes-coordonnees';
  }
  return '/app/tableau-de-bord/onboarding/mon-activite';
}
