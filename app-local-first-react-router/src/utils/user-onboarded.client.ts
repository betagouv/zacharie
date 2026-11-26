import { User, UserRoles } from '@prisma/client';
import { isCircuitCourt, isRoleCircuitCourt } from './circuit-court';
import { sanitizeRedirect } from './sanitize-redirect';

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
  if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
    if (user.onboarded_at) {
      return '/app/collecteur';
    }
    return '/app/collecteur/onboarding/coordonnees';
  }
  if (user.roles.includes(UserRoles.SVI)) {
    if (user.onboarded_at) {
      return '/app/svi';
    }
    return '/app/svi/onboarding/coordonnees';
  }
  if (user.roles.includes(UserRoles.FEDERATION)) {
    if (user.onboarded_at) {
      return '/app/federation/tableau-de-bord';
    }
    return '/app/federation/onboarding/coordonnees';
  }
  if (user.roles.includes(UserRoles.LABORATOIRE)) {
    return '/app/laboratoire';
  }
  if (isCircuitCourt(user)) {
    if (user.onboarded_at) {
      return '/app/circuit-court';
    }
    return '/app/circuit-court/onboarding/coordonnees';
  }
  if (user.isZacharieAdmin) {
    return '/app/admin';
  }
  // compte sans rôle reconnu : la page d'accueil ne redirige pas un utilisateur connecté,
  // contrairement à /app/connexion qui le renverrait ici
  return '/';
}

function canOpenSection(user: User, section: string) {
  switch (section) {
    case 'chasseur':
      return user.roles.includes(UserRoles.CHASSEUR);
    case 'etg':
      return user.roles.includes(UserRoles.ETG);
    case 'collecteur':
      return user.roles.includes(UserRoles.COLLECTEUR_PRO);
    case 'svi':
      return user.roles.includes(UserRoles.SVI);
    case 'federation':
      return user.roles.includes(UserRoles.FEDERATION);
    case 'laboratoire':
      return user.roles.includes(UserRoles.LABORATOIRE);
    case 'circuit-court':
      return user.roles.some((role) => isRoleCircuitCourt(role));
    case 'admin':
      return !!user.isZacharieAdmin;
    default:
      return true;
  }
}

// Page à ouvrir après la connexion : le `redirect` s'il est valide et appartient à l'espace de
// l'utilisateur, sinon sa page d'accueil.
export function getPostLoginRoute(user: User, redirect: string | null | undefined) {
  const path = sanitizeRedirect(redirect);
  if (!path) return getUserOnboardingRoute(user);
  const section = path.split(/[/?#]/)[2] ?? '';
  if (!canOpenSection(user, section)) return getUserOnboardingRoute(user);
  return path;
}
