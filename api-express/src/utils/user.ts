import { User, UserRoles } from '@prisma/client';

export function hasAllRequiredFields(user: User) {
  if (!user.numero_cfei) {
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return false;
    }
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
  if (!user.telephone) {
    return false;
  }
  if (!user.email) {
    return false;
  }
  if (!user.nom_de_famille) {
    return false;
  }
  return true;
}

export function autoActivatePremierDetenteur(user: User) {
  if (!!user.activated) return false;
  if (!!user.activated_at) return false; // already auto activated once, if not activated now it need to be manually activated
  if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) return false;
  if (user.roles.length > 1) return false;
  if (!hasAllRequiredFields(user)) return false;
  return true;
}
