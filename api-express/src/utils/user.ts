import { User, UserRoles } from '@prisma/client';

export function hasAllRequiredFields(user: User) {
  if (!user.telephone) {
    return false;
  }
  if (!user.email) {
    return false;
  }
  if (!user.nom_de_famille) {
    return false;
  }
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (user.numero_cfei) {
      // si un chasseur a un numéro CFEI, il doit y avoir une vérification manuelle
      return false;
    }
    if (!user.addresse_ligne_1) {
      return false;
    }
    if (!user.code_postal) {
      return false;
    }
    if (!user.ville) {
      return false;
    }
  }
  return true;
}

export function autoActivatePremierDetenteur(user: User) {
  if (!!user.activated) return false;
  if (!!user.activated_at) return false; // already auto activated once, if not activated now it need to be manually activated
  if (user.roles.includes(UserRoles.ADMIN)) return false;
  if (!hasAllRequiredFields(user)) return false;
  return true;
}
