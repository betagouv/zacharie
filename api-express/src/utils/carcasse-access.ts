import { FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { Entity, User } from '@prisma/client';
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
  if (hasIntermediaireCarcasseScope(user)) {
    // Même périmètre en SQL brut dans findIntermediaireScopeCarcassesPage : les deux doivent rester identiques.
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

const INTERMEDIAIRE_SCOPE_ROLES: Array<UserRoles> = [
  UserRoles.ETG,
  UserRoles.COLLECTEUR_PRO,
  UserRoles.COMMERCE_DE_DETAIL,
  UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
  UserRoles.ASSOCIATION_CARITATIVE,
  UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  UserRoles.CONSOMMATEUR_FINAL,
];

// Rôles dont le périmètre passe par CarcasseIntermediaire (SVI et chasseur ont leur propre périmètre,
// prioritaire dans getCarcasseAccessWhere).
export function hasIntermediaireCarcasseScope(user: Pick<User, 'roles'>): boolean {
  if (user.roles.includes(UserRoles.SVI) || user.roles.includes(UserRoles.CHASSEUR)) return false;
  return user.roles.some((role) => INTERMEDIAIRE_SCOPE_ROLES.includes(role));
}

// Une page du pull GET /carcasse pour un périmètre intermédiaire, dans l'ordre (updated_at, id)
// décroissant. Le OR de getCarcasseAccessWhere mêle un EXISTS sur CarcasseIntermediaire et deux
// colonnes de Carcasse : Postgres ne peut servir aucune des trois branches par son index et lit
// toute la table. Ici chaque branche est une requête à part, servie par son index, limitée à une
// page, puis les trois sont fusionnées.
export async function findIntermediaireScopeCarcassesPage({
  entityIds,
  includeDeleted,
  afterDate,
  cursor,
  limit,
}: {
  entityIds: Array<string>;
  includeDeleted: boolean;
  afterDate: Date | undefined;
  cursor: { updatedAt: Date; id: string } | undefined;
  limit: number;
}) {
  if (!entityIds.length) return [];
  // updated_at est un timestamp sans fuseau, stocké en UTC par Prisma
  const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const filters = Prisma.sql`${includeDeleted ? Prisma.empty : Prisma.sql`AND c.deleted_at IS NULL`}
    ${afterDate ? Prisma.sql`AND c.updated_at >= ${utc(afterDate)}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND (c.updated_at, c.zacharie_carcasse_id) < (${utc(cursor.updatedAt)}, ${cursor.id})` : Prisma.empty}`;
  const branch = (condition: Prisma.Sql) => Prisma.sql`(
    SELECT c.zacharie_carcasse_id, c.updated_at FROM "Carcasse" c
    WHERE ${condition} ${filters}
    ORDER BY c.updated_at DESC, c.zacharie_carcasse_id DESC
    LIMIT ${limit}
  )`;
  const rows = await prisma.$queryRaw<Array<{ zacharie_carcasse_id: string }>>`
    SELECT u.zacharie_carcasse_id FROM (
      ${branch(Prisma.sql`c.zacharie_carcasse_id IN (
        SELECT ci.zacharie_carcasse_id FROM "CarcasseIntermediaire" ci
        WHERE ci.intermediaire_entity_id IN (${Prisma.join(entityIds)})
      )`)}
      UNION
      ${branch(Prisma.sql`c.next_owner_entity_id IN (${Prisma.join(entityIds)})`)}
      UNION
      ${branch(Prisma.sql`c.current_owner_entity_id IN (${Prisma.join(entityIds)})`)}
    ) u
    ORDER BY u.updated_at DESC, u.zacharie_carcasse_id DESC
    LIMIT ${limit}
  `;
  if (!rows.length) return [];
  return prisma.carcasse.findMany({
    where: { zacharie_carcasse_id: { in: rows.map((row) => row.zacharie_carcasse_id) } },
    orderBy: [{ updated_at: 'desc' }, { zacharie_carcasse_id: 'desc' }],
  });
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
