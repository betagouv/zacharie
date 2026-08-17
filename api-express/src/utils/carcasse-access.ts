import { FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { Fei, User } from '@prisma/client';
import prisma from '~/prisma';
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

// Sous-ensemble des carcasses demandées auxquelles l'utilisateur a accès. Une seule requête pour
// tout le lot : le sync de masse porte plusieurs centaines de carcasses.
export async function getAccessibleCarcasseIds(
  user: User,
  zacharieCarcasseIds: Array<string>,
  userEntityIds?: Array<string>
): Promise<Set<string>> {
  if (!zacharieCarcasseIds.length) return new Set();
  const accessWhere = await getCarcasseAccessWhere(user, userEntityIds);
  if (!accessWhere) return new Set();
  const accessible = await prisma.carcasse.findMany({
    where: { zacharie_carcasse_id: { in: zacharieCarcasseIds }, ...accessWhere },
    select: { zacharie_carcasse_id: true },
  });
  return new Set(accessible.map((carcasse) => carcasse.zacharie_carcasse_id));
}

// Le Set d'un lot est un instantané pris avant la boucle : une carcasse créée entre-temps par une
// requête de sync concurrente n'y figure pas encore. Un refus doit reposer sur l'état courant, pas
// sur un instantané périmé — on revérifie donc en base avant de refuser, jamais avant d'accepter.
export async function isCarcasseAccessible(
  user: User,
  zacharieCarcasseId: string,
  opts: { accessibleCarcasseIds?: Set<string>; userEntityIds?: Array<string> } = {}
): Promise<boolean> {
  if (opts.accessibleCarcasseIds?.has(zacharieCarcasseId)) return true;
  const accessible = await getAccessibleCarcasseIds(user, [zacharieCarcasseId], opts.userEntityIds);
  return accessible.has(zacharieCarcasseId);
}

type FeiOwnershipFields = Pick<
  Fei,
  | 'numero'
  | 'created_by_user_id'
  | 'examinateur_initial_user_id'
  | 'premier_detenteur_user_id'
  | 'premier_detenteur_entity_id'
>;

// Rattachement direct à la fiche : créateur, examinateur initial, premier détenteur (utilisateur ou
// entité désignée). Ce sont les colonnes de la fiche elle-même, celles qui ouvrent l'écriture — d'où
// la règle : seul un rattaché peut les modifier (voir `sync-fei` / `sync-carcasse`), sans quoi un
// détenteur aval s'y inscrirait pour se donner un accès permanent.
export async function isFeiOwner(
  user: User,
  fei: FeiOwnershipFields,
  userEntityIds?: Array<string>
): Promise<boolean> {
  if (fei.created_by_user_id === user.id) return true;
  if (fei.examinateur_initial_user_id === user.id) return true;
  if (fei.premier_detenteur_user_id === user.id) return true;
  if (!fei.premier_detenteur_entity_id) return false;
  const entityIds = userEntityIds ?? (await getUserCarcasseEntityIds(user.id));
  return entityIds.includes(fei.premier_detenteur_entity_id);
}

// Droit d'écrire sur une fiche : les colonnes de la fiche ne portent que le début de la chaîne
// (créateur, examinateur, premier détenteur). Pour les détenteurs suivants, la participation se lit
// sur les carcasses, comme le fait déjà `/carcasse/refusees/:fei_numero`.
export async function canWriteFei(
  user: User,
  fei: FeiOwnershipFields,
  userEntityIds?: Array<string>
): Promise<boolean> {
  if (user.isZacharieAdmin) return true;

  const entityIds = userEntityIds ?? (await getUserCarcasseEntityIds(user.id));
  if (await isFeiOwner(user, fei, entityIds)) return true;

  const accessWhere = await getCarcasseAccessWhere(user, entityIds);
  if (!accessWhere) return false;
  const carcassesInScope = await prisma.carcasse.count({
    where: { fei_numero: fei.numero, ...accessWhere },
  });
  return carcassesInScope > 0;
}
