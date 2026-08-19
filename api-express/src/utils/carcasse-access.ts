import { Entity, FeiOwnerRole, Prisma, User, UserRoles } from '@prisma/client';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';

// Périmètre d'accès aux carcasses selon le rôle d'un utilisateur. Retourne le WHERE Prisma
// (ou null si rôle non supporté). Partagé entre le pull delta `/carcasse`, la route
// `/carcasse/refusees/:fei_numero` et l'API publique v1 : autorisation strictement identique partout.
export async function getCarcasseAccessWhereForUser(
  user: Pick<User, 'id' | 'roles'>
): Promise<Prisma.CarcasseWhereInput | null> {
  const userEntityIds = await getUserCarcasseEntityIds(user.id);

  if (user.roles.includes(UserRoles.SVI)) {
    return {
      svi_assigned_at: { not: null },
      OR: [{ svi_entity_id: { in: userEntityIds } }, { next_owner_entity_id: { in: userEntityIds } }],
    };
  }
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    return {
      OR: [
        { premier_detenteur_user_id: user.id },
        { examinateur_initial_user_id: user.id },
        // Désignation du premier détenteur (asso) : on n'expose la fiche aux membres de l'entité
        // qu'une fois la fiche réellement transmise (sortie de l'examinateur initial).
        {
          premier_detenteur_entity_id: { in: userEntityIds },
          current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
        },
        {
          next_owner_entity_id: { in: userEntityIds },
          current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
        },
        { prev_owner_entity_id: { in: userEntityIds } },
        { current_owner_entity_id: { in: userEntityIds } },
        { next_owner_user_id: user.id },
        { prev_owner_user_id: user.id },
        { current_owner_user_id: user.id },
      ],
    };
  }
  if (
    user.roles.includes(UserRoles.ETG) ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) ||
    user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) ||
    user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) ||
    user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) ||
    user.roles.includes(UserRoles.CONSOMMATEUR_FINAL)
  ) {
    return {
      OR: [
        { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: userEntityIds } } } },
        { next_owner_entity_id: { in: userEntityIds } },
        { current_owner_entity_id: { in: userEntityIds } },
      ],
    };
  }
  return null;
}

// Périmètre d'accès pour une clé API dédiée à une entité : toutes les carcasses où l'entité
// apparaît dans une colonne de propriété (premier détenteur, intermédiaire, SVI, owner courant/suivant/précédent).
export function getCarcasseAccessWhereForEntity(entity: Pick<Entity, 'id'>): Prisma.CarcasseWhereInput {
  return {
    OR: [
      { svi_entity_id: entity.id },
      { premier_detenteur_entity_id: entity.id },
      { current_owner_entity_id: entity.id },
      { next_owner_entity_id: entity.id },
      { prev_owner_entity_id: entity.id },
      { CarcasseIntermediaire: { some: { intermediaire_entity_id: entity.id } } },
    ],
  };
}
