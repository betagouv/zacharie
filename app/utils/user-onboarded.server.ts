import { User } from "@prisma/client";

export function getUserOnboardingRoute(user: User): string | null {
  if (user.onboarded_at) return null;
  return "/tableau-de-bord/mon-profil/mes-roles";
}
