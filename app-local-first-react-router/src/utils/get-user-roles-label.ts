import { UserRoles } from "@prisma/client";

export function getUserRoleLabel(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "Administrateur";
    case UserRoles.PREMIER_DETENTEUR:
      return "Premier Détenteur";
    case UserRoles.EXAMINATEUR_INITIAL:
      return "Examinateur Initial";
    case UserRoles.CCG:
      return "Centre de Collecte du Gibier sauvage";
    case UserRoles.COLLECTEUR_PRO:
      return "Collecteur Pro";
    case UserRoles.ETG:
      return "Etablissement de Traitement du Gibier sauvage";
    case UserRoles.SVI:
      return "Service Vétérinaire d'Inspection";
    default:
      return "Inconnu";
  }
}

export function getUserRoleLabelPlural(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "Administrateur";
    case UserRoles.PREMIER_DETENTEUR:
      return "Premiers Détenteurs";
    case UserRoles.EXAMINATEUR_INITIAL:
      return "Examinateurs Initiaux";
    case UserRoles.CCG:
      return "Centres de Collecte du Gibier sauvage";
    case UserRoles.COLLECTEUR_PRO:
      return "Collecteurs Pro";
    case UserRoles.ETG:
      return "Etablissements de Traitement du Gibier sauvage";
    case UserRoles.SVI:
      return "Services Vétérinaire d'Inspection";
    default:
      return "Inconnu";
  }
}

export function getUserRoleLabelPrefixed(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "de l'Administrateur";
    case UserRoles.PREMIER_DETENTEUR:
      return "du Premier Détenteur";
    case UserRoles.EXAMINATEUR_INITIAL:
      return "de l'Examinateur Initial";
    case UserRoles.CCG:
      return "d'un Centre de Collecte du Gibier sauvage";
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
