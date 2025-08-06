import { EntityTypes, FeiOwnerRole, UserRoles } from '@prisma/client';

export function getUserRoleLabel(role: UserRoles | FeiOwnerRole | EntityTypes | '') {
  switch (role) {
    case UserRoles.ADMIN:
      return 'Administrateur';
    case FeiOwnerRole.PREMIER_DETENTEUR:
      return 'Premier Détenteur';
    case FeiOwnerRole.EXAMINATEUR_INITIAL:
      return 'Examinateur Initial';
    case EntityTypes.CCG:
      return 'Centre de Collecte du Gibier sauvage';
    case EntityTypes.COLLECTEUR_PRO:
      return 'Collecteur Professionnel Indépendant';
    case EntityTypes.ETG:
      return 'Etablissement de Traitement du Gibier sauvage';
    case EntityTypes.SVI:
      return "Service Vétérinaire d'Inspection";
    default:
      return 'Inconnu';
  }
}

export function getUserRoleLabelPlural(role: UserRoles | FeiOwnerRole | EntityTypes | '') {
  switch (role) {
    case UserRoles.ADMIN:
      return 'Administrateur';
    case FeiOwnerRole.PREMIER_DETENTEUR:
      return 'Premiers Détenteurs';
    case FeiOwnerRole.EXAMINATEUR_INITIAL:
      return 'Examinateurs Initiaux';
    case EntityTypes.CCG:
      return 'Centres de Collecte du Gibier sauvage';
    case EntityTypes.COLLECTEUR_PRO:
      return 'Collecteurs Pro';
    case EntityTypes.ETG:
      return 'Etablissements de Traitement du Gibier sauvage';
    case EntityTypes.SVI:
      return "Services Vétérinaire d'Inspection";
    default:
      return 'Inconnu';
  }
}

export function getUserRoleLabelPrefixed(role: UserRoles | FeiOwnerRole | EntityTypes | '') {
  switch (role) {
    case UserRoles.ADMIN:
      return "de l'Administrateur";
    case FeiOwnerRole.PREMIER_DETENTEUR:
      return 'du Premier Détenteur';
    case FeiOwnerRole.EXAMINATEUR_INITIAL:
      return "de l'Examinateur Initial";
    case EntityTypes.CCG:
      return "d'un Centre de Collecte du Gibier sauvage";
    case EntityTypes.COLLECTEUR_PRO:
      return "d'un Collecteur Pro";
    case EntityTypes.ETG:
      return "d'un ETG";
    case EntityTypes.SVI:
      return "du Service Vétérinaire d'Inspection";
    default:
      return 'de je ne sais qui';
  }
}

export function getIntermediaireRoleLabel(role: FeiOwnerRole) {
  switch (role) {
    case EntityTypes.COLLECTEUR_PRO:
      return 'Transport des carcasses';
    case EntityTypes.ETG:
      return 'Réception des carcasses';
    default:
      return 'Inconnu';
  }
}

export function getCurrentOwnerRoleLabel(role: FeiOwnerRole) {
  switch (role) {
    case EntityTypes.COLLECTEUR_PRO:
      return 'Collecteur Professionnel Indépendant';
    case EntityTypes.ETG:
      return 'Etablissement de Traitement du Gibier sauvage';
    default:
      return 'Inconnu';
  }
}
