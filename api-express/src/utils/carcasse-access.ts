import { FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';

// Périmètre d'accès aux carcasses selon le rôle. Retourne le WHERE Prisma (ou null si rôle non
// supporté). Partagé entre les routes de lecture (`/carcasse`, `/carcasse/refusees/:fei_numero`)
// et les écritures de `/sync`, pour que lire et écrire reposent sur la même définition d'accès.
export async function getCarcasseAccessWhere(
  user: User,
  userEntityIds?: Array<string>
): Promise<Prisma.CarcasseWhereInput | null> {
  const entityIds = userEntityIds ?? (await getUserCarcasseEntityIds(user.id));

  if (user.roles.includes(UserRoles.SVI)) {
    return {
      svi_assigned_at: { not: null },
      OR: [{ svi_entity_id: { in: entityIds } }, { next_owner_entity_id: { in: entityIds } }],
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
          premier_detenteur_entity_id: { in: entityIds },
          current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
        },
        {
          next_owner_entity_id: { in: entityIds },
          current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
        },
        { prev_owner_entity_id: { in: entityIds } },
        { current_owner_entity_id: { in: entityIds } },
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
        { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: entityIds } } } },
        { next_owner_entity_id: { in: entityIds } },
        { current_owner_entity_id: { in: entityIds } },
      ],
    };
  }
  return null;
}
