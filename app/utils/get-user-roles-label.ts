import { UserRoles } from "@prisma/client";

export default function getUserRoleLabel(role: UserRoles | "") {
  switch (role) {
    case UserRoles.ADMIN:
      return "Administrateur";
    case UserRoles.DETENTEUR_INITIAL:
      return "Détenteur Initial";
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
