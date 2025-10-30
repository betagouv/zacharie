import { User, UserRoles } from '@prisma/client';

export function hasAllRequiredFields(user: User) {
  if (!user.prenom) {
    return false;
  }
  if (!user.nom_de_famille) {
    return false;
  }
  if (!user.telephone) {
    return false;
  }
  if (!user.email) {
    return false;
  }
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (user.est_forme_a_l_examen_initial == null) {
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
