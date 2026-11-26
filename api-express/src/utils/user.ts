import { User, UserRoles } from '@prisma/client';

export function hasAllRequiredFields(user: User, calledFrom: string) {
  if (!user.onboarded_at) {
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
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (user.numero_cfei) {
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

export function autoActivatePremierDetenteur(user: User, calledFrom: string) {
  if (user.activated) {
    return false;
  }
  if (user.activated_at) {
    return false;
  }
  if (user.isZacharieAdmin) {
    return false;
  }
  if (!hasAllRequiredFields(user, calledFrom)) {
    return false;
  }
  if (user.est_forme_a_l_examen_initial) {
    return false;
  }
  return true;
}
