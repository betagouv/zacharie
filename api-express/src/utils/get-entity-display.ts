import { EntityTypes, FeiOwnerRole, UserRoles } from '@prisma/client';

export function getEntityDisplay(role: UserRoles | FeiOwnerRole | EntityTypes | '') {
  switch (role) {
    case FeiOwnerRole.COMMERCE_DE_DETAIL:
      return 'Commerce de Détail';
    case FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF:
      return 'Repas de Chasse ou Associatif';
    case FeiOwnerRole.CONSOMMATEUR_FINAL:
      return 'Consommateur Final';
    default:
      return 'Inconnu';
  }
}
