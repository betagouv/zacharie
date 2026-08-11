import { EntityTypes, FeiOwnerRole, Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';

/*
 *
 * Data health check
 *
 * En local-first offline, le backend ne voit jamais les états intermédiaires : il reçoit des deltas
 * déjà décidés côté client, souvent dans le désordre. Certaines incohérences sont valides ligne par
 * ligne mais fausses globalement — aucune validation à l'écriture ne peut les attraper.
 *
 * Ce cron balaie l'état global à froid, une fois par jour. Il est READ-ONLY : il signale à Sentry,
 * il ne répare jamais automatiquement (une réparation pourrait entrer en course avec un delta client
 * encore en vol). Chaque check doit tendre vers 0 en régime normal : sinon, corriger à la source ou
 * exclure explicitement le cas, pour éviter la fatigue d'alerte.
 *
 * Test it: run `npm run dev-cronjobs` et regarde les logs.
 *
 */

const SAMPLE_SIZE = 20;

// Rôles qui désignent TOUJOURS une entité (organisation), jamais une personne.
// PREMIER_DETENTEUR et les rôles circuit court (commerce, cantine, asso, repas, conso final) sont
// volontairement exclus : ils peuvent être portés soit par un user, soit par une entité.
const ROLES_REQUIRING_ENTITY: Array<FeiOwnerRole> = [
  FeiOwnerRole.ETG,
  FeiOwnerRole.SVI,
  FeiOwnerRole.COLLECTEUR_PRO,
];

export type HealthCheck = {
  name: string;
  // sampleIds = échantillon d'identifiants concernés (carcasse ou user selon le check)
  run: () => Promise<{ count: number; sampleIds: string[] }>;
};

// Compte + échantillon en deux requêtes : on ne rapatrie jamais tout le jeu de lignes pour compter.
async function countCarcassesWithSample(where: Prisma.CarcasseWhereInput) {
  const [count, rows] = await Promise.all([
    prisma.carcasse.count({ where }),
    prisma.carcasse.findMany({
      where,
      select: { zacharie_carcasse_id: true },
      orderBy: { created_at: 'asc' },
      take: SAMPLE_SIZE,
    }),
  ]);
  return { count, sampleIds: rows.map((r) => r.zacharie_carcasse_id) };
}

export const checks: HealthCheck[] = [
  {
    // Cf. scripts/20260803_cloture_fiches.sql
    // L'examinateur initial est TOUJOURS une personne : un current_owner_entity_id sur une carcasse
    // restée à ce stade est incohérent et fait basculer la fiche en « à compléter » chez l'aval.
    name: 'Carcasse examinateur avec entité (owner_role=EXAMINATEUR_INITIAL + entity_id non nul)',
    run: () =>
      countCarcassesWithSample({
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
        current_owner_entity_id: { not: null },
        deleted_at: null,
      }),
  },
  {
    // Hard Rule du repo : un seul rôle par user. Impossible à violer via l'UI, mais un import ou un
    // script peut le casser. Ce check est le contrôle backend ultime de l'invariant.
    name: 'User avec plusieurs rôles (viole « un seul rôle par user »)',
    run: async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User"
        WHERE array_length(roles, 1) > 1
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT ${SAMPLE_SIZE};
      `;
      const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "User"
        WHERE array_length(roles, 1) > 1
          AND deleted_at IS NULL;
      `;
      return { count: Number(count), sampleIds: rows.map((r) => r.id) };
    },
  },
  {
    // Une carcasse « appartient » à un rôle mais à personne (ni user ni entité) → invisible dans les
    // listes des deux côtés de la chaîne.
    name: 'Carcasse avec owner_role mais sans owner (ni user_id ni entity_id)',
    run: () =>
      countCarcassesWithSample({
        current_owner_role: { not: null },
        current_owner_user_id: null,
        current_owner_entity_id: null,
        deleted_at: null,
      }),
  },
  {
    // Rôle qui doit être porté par une entité (ETG/SVI/COLLECTEUR_PRO) mais entity_id manquant.
    // Symétrique du check #1 : attrape l'autre sens du bug de propagation d'ownership.
    name: 'Carcasse rôle-entité sans entity_id (ETG/SVI/COLLECTEUR_PRO)',
    run: () =>
      countCarcassesWithSample({
        current_owner_role: { in: ROLES_REQUIRING_ENTITY },
        current_owner_entity_id: null,
        deleted_at: null,
      }),
  },
  {
    // owner_role doit matcher le type de l'entité qui le porte.
    // Quand current_owner_entity_id est renseigné, Entity.type doit égaler current_owner_role.
    // Le rôle décrit l'activité en cours, le type décrit l'établissement : les deux divergent
    // légitimement dans deux cas, qu'on exclut.
    // Exceptions :
    //  - EXAMINATEUR_INITIAL est déjà couvert par le check #1 (on l'exclut ici pour ne pas
    //    double-signaler) ;
    //  - un COLLECTEUR_PRO peut opérer via une entité de type CCG ;
    //  - COLLECTEUR_PRO sur une entité ETG = l'ETG qui assure lui-même son transport amont
    //    (etg_role TRANSPORT, cf. etg-current-owner-confirm.tsx). État transitoire jusqu'à la
    //    confirmation par un salarié etg_role RECEPTION, qui repasse la carcasse en (ETG, ETG).
    name: 'Carcasse owner_role incohérent avec le type de l’entité (owner_entity_id)',
    run: async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.zacharie_carcasse_id AS id
        FROM "Carcasse" c
        JOIN "Entity" e ON e.id = c.current_owner_entity_id
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role IS NOT NULL
          AND c.current_owner_role <> ${FeiOwnerRole.EXAMINATEUR_INITIAL}::"FeiOwnerRole"
          AND c.current_owner_role::text <> e.type::text
          AND NOT (
            c.current_owner_role = ${FeiOwnerRole.COLLECTEUR_PRO}::"FeiOwnerRole"
            AND e.type IN (${EntityTypes.CCG}::"EntityTypes", ${EntityTypes.ETG}::"EntityTypes")
          )
        ORDER BY c.created_at ASC
        LIMIT ${SAMPLE_SIZE};
      `;
      const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Carcasse" c
        JOIN "Entity" e ON e.id = c.current_owner_entity_id
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role IS NOT NULL
          AND c.current_owner_role <> ${FeiOwnerRole.EXAMINATEUR_INITIAL}::"FeiOwnerRole"
          AND c.current_owner_role::text <> e.type::text
          AND NOT (
            c.current_owner_role = ${FeiOwnerRole.COLLECTEUR_PRO}::"FeiOwnerRole"
            AND e.type IN (${EntityTypes.CCG}::"EntityTypes", ${EntityTypes.ETG}::"EntityTypes")
          );
      `;
      return { count: Number(count), sampleIds: rows.map((r) => r.id) };
    },
  },
  {
    // owner_role doit matcher les rôles du user qui le porte.
    // Un examinateur initial est toujours une personne ET un chasseur : si current_owner_user_id ne
    // porte pas le rôle CHASSEUR, l'ownership est incohérent.
    name: 'Carcasse examinateur dont l’owner_user n’est pas CHASSEUR',
    run: async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.zacharie_carcasse_id AS id
        FROM "Carcasse" c
        JOIN "User" u ON u.id = c.current_owner_user_id
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role = ${FeiOwnerRole.EXAMINATEUR_INITIAL}::"FeiOwnerRole"
          AND NOT ('CHASSEUR' = ANY(u.roles))
        ORDER BY c.created_at ASC
        LIMIT ${SAMPLE_SIZE};
      `;
      const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Carcasse" c
        JOIN "User" u ON u.id = c.current_owner_user_id
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role = ${FeiOwnerRole.EXAMINATEUR_INITIAL}::"FeiOwnerRole"
          AND NOT ('CHASSEUR' = ANY(u.roles));
      `;
      return { count: Number(count), sampleIds: rows.map((r) => r.id) };
    },
  },
  {
    // Prise en charge orpheline : la carcasse est détenue par un ETG/collecteur alors qu'aucune
    // CarcasseIntermediaire ne rattache cette entité à la carcasse. La fiche devient une impasse
    // pour le détenteur : pas de bouton « Prendre en charge » (next_owner vide) et pas de section
    // de transmission (elle est dérivée de l'intermédiaire).
    // Restreint aux carcasses encore vivantes : refusées / manquantes / clôturées / déjà au SVI ne
    // bloquent plus personne.
    name: 'Carcasse chez un ETG/COLLECTEUR_PRO sans CarcasseIntermediaire de l’entité détentrice',
    run: async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.zacharie_carcasse_id AS id
        FROM "Carcasse" c
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role IN (
            ${FeiOwnerRole.ETG}::"FeiOwnerRole",
            ${FeiOwnerRole.COLLECTEUR_PRO}::"FeiOwnerRole"
          )
          AND c.current_owner_entity_id IS NOT NULL
          AND c.next_owner_role IS NULL
          AND c.svi_assigned_at IS NULL
          AND c.svi_closed_at IS NULL
          AND c.svi_automatic_closed_at IS NULL
          AND c.intermediaire_closed_at IS NULL
          AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
          AND c.intermediaire_carcasse_manquante IS NOT TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "CarcasseIntermediaire" ci
            WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
              AND ci.deleted_at IS NULL
              AND ci.intermediaire_entity_id = c.current_owner_entity_id
          )
        ORDER BY c.created_at ASC
        LIMIT ${SAMPLE_SIZE};
      `;
      const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Carcasse" c
        WHERE c.deleted_at IS NULL
          AND c.current_owner_role IN (
            ${FeiOwnerRole.ETG}::"FeiOwnerRole",
            ${FeiOwnerRole.COLLECTEUR_PRO}::"FeiOwnerRole"
          )
          AND c.current_owner_entity_id IS NOT NULL
          AND c.next_owner_role IS NULL
          AND c.svi_assigned_at IS NULL
          AND c.svi_closed_at IS NULL
          AND c.svi_automatic_closed_at IS NULL
          AND c.intermediaire_closed_at IS NULL
          AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
          AND c.intermediaire_carcasse_manquante IS NOT TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "CarcasseIntermediaire" ci
            WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
              AND ci.deleted_at IS NULL
              AND ci.intermediaire_entity_id = c.current_owner_entity_id
          );
      `;
      return { count: Number(count), sampleIds: rows.map((r) => r.id) };
    },
  },
];

export async function dataHealthCheck() {
  console.log('Inside data-health cronjob');
  for (const check of checks) {
    const { count, sampleIds } = await check.run();
    console.log(`[data-health] ${check.name}: ${count}`);
    if (count > 0) {
      capture(new Error(`[data-health] ${check.name}: ${count} ligne(s) incohérente(s)`), {
        level: 'warning',
        extra: { count, sampleIds },
      });
    }
  }
}

export async function initDataHealthCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'Data health check',
          // tous les jours à 6h (avant le closing automatique de 8h)
          cronTime: '0 6 * * *',
          job: dataHealthCheck,
          runOnInit: false,
        })
    )
    .then(() => {
      console.log('Data health cron job is set up');
    })
    .catch(capture);
}
