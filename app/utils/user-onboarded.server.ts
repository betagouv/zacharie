import { User } from "@prisma/client";

export function getUserOnboardingRoute(user: User): string | null {
  if (user.onboarded_at) return null;
  if (user.prefilled) {
    // we want them to go thourgh the onboarding steps even if we did prefilled their data
    return "/tableau-de-bord/onboarding-etape-1";
  }
  if (!user.roles.length) {
    return "/tableau-de-bord/onboarding-etape-1";
  }
  if (!user.nom_de_famille) {
    return "/tableau-de-bord/onboarding-etape-2";
  }
  return null;
}
