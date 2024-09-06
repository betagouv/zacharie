import { User } from "@prisma/client";

export function getUserOnboardingRoute(user: User): string | null {
  if (user.onboarded_at) return null;
  return "/tableau-de-bord/onboarding-etape-1";
}
