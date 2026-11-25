import { EntityTypes, FeiOwnerRole, Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';

const SAMPLE_SIZE = 20;

const ROLES_REQUIRING_ENTITY: Array<FeiOwnerRole> = [
  FeiOwnerRole.ETG,
  FeiOwnerRole.SVI,
  FeiOwnerRole.COLLECTEUR_PRO,
];

export type HealthCheck = {
  name: string;
  run: () => Promise<{ count: number; sampleIds: string[] }>;
};

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
    name: 'Carcasse examinateur avec entité (owner_role=EXAMINATEUR_INITIAL + entity_id non nul)',
    run: () =>
      countCarcassesWithSample({
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
        current_owner_entity_id: { not: null },
        deleted_at: null,
      }),
  },
  {
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
    name: 'Carcasse rôle-entité sans entity_id (ETG/SVI/COLLECTEUR_PRO)',
    run: () =>
      countCarcassesWithSample({
        current_owner_role: { in: ROLES_REQUIRING_ENTITY },
        current_owner_entity_id: null,
        deleted_at: null,
      }),
  },
  {
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
