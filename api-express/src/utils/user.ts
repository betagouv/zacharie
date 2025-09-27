import { User, UserRoles } from '@prisma/client';

export function hasAllRequiredFields(user: User, calledFrom: string) {
  if (!user.onboarded_at) {
    // console.log('user.onboarded_at', user.onboarded_at, calledFrom);
    return false;
  }
  if (!user.telephone) {
    // console.log('user.telephone', user.telephone, calledFrom);
    return false;
  }
  if (!user.email) {
    // console.log('user.email', user.email, calledFrom);
    return false;
  }
  if (!user.nom_de_famille) {
    // console.log('user.nom_de_famille', user.nom_de_famille, calledFrom);
    return false;
  }
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (user.numero_cfei) {
      // si un chasseur a un numéro CFEI, il doit y avoir une vérification manuelle
      // console.log('user.numero_cfei', user.numero_cfei, calledFrom);
      return false;
    }
    if (!user.addresse_ligne_1) {
      // console.log('user.addresse_ligne_1', user.addresse_ligne_1, calledFrom);
      return false;
    }
    if (!user.code_postal) {
      // console.log('user.code_postal', user.code_postal, calledFrom);
      return false;
    }
    if (!user.ville) {
      // console.log('user.ville', user.ville, calledFrom);
      return false;
    }
  }
  // console.log('user has all required fields', calledFrom);
  return true;
}

export function autoActivatePremierDetenteur(user: User, calledFrom: string) {
  if (!!user.activated) {
    // console.log('user.activated', user.activated, calledFrom);
    return false;
  }
  if (!!user.activated_at) {
    // already auto activated once, if not activated now it need to be manually activated
    // console.log('user.activated_at', user.activated_at, calledFrom);
    return false;
  }
  if (user.roles.includes(UserRoles.ADMIN)) {
    // console.log('user.roles.includes(UserRoles.ADMIN)', user.roles.includes(UserRoles.ADMIN), calledFrom);
    return false;
  }
  if (!hasAllRequiredFields(user, calledFrom)) {
    // console.log('!hasAllRequiredFields(user)', !hasAllRequiredFields(user, calledFrom), calledFrom);
    return false;
  }
  // console.log('autoActivatePremierDetenteur', calledFrom);
  return true;
}
