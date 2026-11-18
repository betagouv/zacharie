import { FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { Carcasse, Entity, User } from '@prisma/client';
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

// Une branche du périmètre : une condition sur Carcasse, ou les carcasses passées par des entités
// intermédiaires (CarcasseIntermediaire).
export type CarcasseScopeBranch =
  | { carcasseCondition: Prisma.Sql }
  | { intermediaireEntityIds: Array<string> };

// Le même périmètre que getCarcasseAccessWhere, en SQL brut : une branche par condition du OR. Les deux
// doivent rester identiques (vérifié sur une vraie base dans carcasse-scope.db.test.ts). Retourne null
// si le rôle n'est pas supporté, [] si l'utilisateur n'a accès à aucune carcasse.
export function getCarcasseScopeBranches(
  user: Pick<User, 'id' | 'roles'>,
  entityIds: Array<string>
): Array<CarcasseScopeBranch> | null {
  const inEntities = (column: string, extra: Prisma.Sql = Prisma.empty): Array<CarcasseScopeBranch> =>
    entityIds.length
      ? [{ carcasseCondition: Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(entityIds)}) ${extra}` }]
      : [];
  const isUser = (column: string): CarcasseScopeBranch => ({
    carcasseCondition: Prisma.sql`${Prisma.raw(column)} = ${user.id}`,
  });

  if (user.roles.includes(UserRoles.SVI)) {
    const assigned = Prisma.sql`AND c.svi_assigned_at IS NOT NULL`;
    return [...inEntities('c.svi_entity_id', assigned), ...inEntities('c.next_owner_entity_id', assigned)];
  }
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    // `<>` exclut les current_owner_role NULL, comme `{ not: ... }` de Prisma
    const transmise = Prisma.sql`AND c.current_owner_role <> ${FeiOwnerRole.EXAMINATEUR_INITIAL}::"FeiOwnerRole"`;
    return [
      isUser('c.premier_detenteur_user_id'),
      isUser('c.examinateur_initial_user_id'),
      ...inEntities('c.premier_detenteur_entity_id', transmise),
      ...inEntities('c.next_owner_entity_id', transmise),
      ...inEntities('c.prev_owner_entity_id'),
      ...inEntities('c.current_owner_entity_id'),
      isUser('c.next_owner_user_id'),
      isUser('c.prev_owner_user_id'),
      isUser('c.current_owner_user_id'),
    ];
  }
  if (hasIntermediaireCarcasseScope(user)) {
    return [
      ...(entityIds.length ? [{ intermediaireEntityIds: entityIds }] : []),
      ...inEntities('c.next_owner_entity_id'),
      ...inEntities('c.current_owner_entity_id'),
    ];
  }
  return null;
}

// Une page du pull GET /carcasse, dans l'ordre (updated_at, id) décroissant. Un OR sur plusieurs
// colonnes ne peut être servi par aucun index : Postgres lit tout le périmètre puis le trie, à chaque
// page. Ici chaque branche est une requête à part, servie par son index (colonne, updated_at desc),
// limitée à une page, puis les branches sont fusionnées.
export async function findScopeCarcassesPage({
  branches,
  includeDeleted,
  afterDate,
  cursor,
  limit,
}: {
  branches: Array<CarcasseScopeBranch>;
  includeDeleted: boolean;
  afterDate: Date | undefined;
  cursor: { updatedAt: Date; id: string } | undefined;
  limit: number;
}): Promise<{ carcasses: Array<Carcasse>; hasMore: boolean }> {
  if (!branches.length) return { carcasses: [], hasMore: false };
  // updated_at est un timestamp sans fuseau, stocké en UTC par Prisma
  const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  // updatedAt : colonne de date de la carcasse lue par l'index de la branche
  const filters = (updatedAt: string, id: string) => Prisma.sql`
    ${includeDeleted ? Prisma.empty : Prisma.sql`AND c.deleted_at IS NULL`}
    ${afterDate ? Prisma.sql`AND ${Prisma.raw(updatedAt)} >= ${utc(afterDate)}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND (${Prisma.raw(updatedAt)}, ${Prisma.raw(id)}) < (${utc(cursor.updatedAt)}, ${cursor.id})` : Prisma.empty}`;
  const branchPage = (branch: CarcasseScopeBranch) =>
    'carcasseCondition' in branch
      ? Prisma.sql`(
          SELECT c.zacharie_carcasse_id, c.updated_at FROM "Carcasse" c
          WHERE (${branch.carcasseCondition}) ${filters('c.updated_at', 'c.zacharie_carcasse_id')}
          ORDER BY c.updated_at DESC, c.zacharie_carcasse_id DESC
          LIMIT ${limit}
        )`
      : // L'entité est sur CarcasseIntermediaire et la date sur Carcasse : la copie
        // CarcasseIntermediaire.carcasse_updated_at (posée par trigger) les réunit dans un seul index.
        // DISTINCT avant LIMIT : une carcasse peut passer plusieurs fois par la même entité.
        Prisma.sql`(
          SELECT DISTINCT ci.zacharie_carcasse_id, ci.carcasse_updated_at AS updated_at
          FROM "CarcasseIntermediaire" ci
          JOIN "Carcasse" c ON c.zacharie_carcasse_id = ci.zacharie_carcasse_id
          WHERE ci.intermediaire_entity_id IN (${Prisma.join(branch.intermediaireEntityIds)})
            ${filters('ci.carcasse_updated_at', 'ci.zacharie_carcasse_id')}
          ORDER BY 2 DESC, 1 DESC
          LIMIT ${limit}
        )`;
  const rows = await prisma.$queryRaw<Array<{ zacharie_carcasse_id: string }>>`
    SELECT u.zacharie_carcasse_id FROM (
      ${Prisma.join(branches.map(branchPage), ' UNION ')}
    ) u
    ORDER BY u.updated_at DESC, u.zacharie_carcasse_id DESC
    LIMIT ${limit}
  `;
  // hasMore se lit sur la page d'ids : la relecture par id peut en perdre une (suppression entre les
  // deux requêtes), et une page pleine prise pour la dernière arrêterait le pull du client.
  const hasMore = rows.length === limit;
  if (!rows.length) return { carcasses: [], hasMore };
  const carcasses = await prisma.carcasse.findMany({
    where: { zacharie_carcasse_id: { in: rows.map((row) => row.zacharie_carcasse_id) } },
    orderBy: [{ updated_at: 'desc' }, { zacharie_carcasse_id: 'desc' }],
  });
  return { carcasses, hasMore };
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
