import { User } from "@prisma/client";

export function getUserOnboardingRoute(user: User): string | null {
  if (!user.roles.length) {
    return "/tableau-de-bord/onboarding-etape-1";
  }
  if (!user.nom_de_famille) {
    return "/tableau-de-bord/onboarding-etape-2";
  }
  return null;
}
