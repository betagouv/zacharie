import { UserRoles } from "@prisma/client";

export function getUserRoleLabel(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "Administrateur";
    case UserRoles.DETENTEUR_INITIAL:
      return "Premier Détenteur";
    case UserRoles.EXAMINATEUR_INITIAL:
      return "Examinateur Initial";
    case UserRoles.EXPLOITANT_CENTRE_COLLECTE:
      return "Exploitant de Centre de Collecte";
    case UserRoles.COLLECTEUR_PRO:
      return "Collecteur Pro";
    case UserRoles.ETG:
      return "ETG";
    case UserRoles.SVI:
      return "Service Vétérinaire d'Inspection";
    default:
      return "Inconnu";
  }
}

export function getUserRoleLabelPrefixed(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "de l'Administrateur";
    case UserRoles.DETENTEUR_INITIAL:
      return "du Premier Détenteur";
    case UserRoles.EXAMINATEUR_INITIAL:
      return "de l'Examinateur Initial";
    case UserRoles.EXPLOITANT_CENTRE_COLLECTE:
      return "d'un Exploitant de Centre de Collecte";
    case UserRoles.COLLECTEUR_PRO:
      return "d'un Collecteur Pro";
    case UserRoles.ETG:
      return "d'un ETG";
    case UserRoles.SVI:
      return "du Service Vétérinaire d'Inspection";
    default:
      return "de je ne sais qui";
  }
}
