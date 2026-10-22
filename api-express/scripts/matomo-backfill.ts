/**
 * Import one-shot de l'historique Matomo dans les tables matomo_*_daily (cf doc/matomo.md).
 * Un appel Matomo par mois pour garder des réponses de taille raisonnable. Idempotent : relancer
 * sur une période déjà importée réécrit les mêmes lignes.
 *
 * Usage :
 *   cd api-express
 *   MATOMO_TOKEN=... MATOMO_SITE_ID=... POSTGRESQL_ADDON_URI=postgres://... \
 *     npm run matomo-backfill -- --from 2025-01-01 --to 2026-10-20
 */
import prisma from '~/prisma';
import { splitByMonth, syncMatomoStats } from '~/utils/matomo-stats';

function readDateArg(name: string): string {
  const value = process.argv[process.argv.indexOf(`--${name}`) + 1];
  if (!process.argv.includes(`--${name}`) || !/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new Error(`--${name} YYYY-MM-DD est obligatoire`);
  }
  return value;
}

async function main() {
  const from = readDateArg('from');
  const to = readDateArg('to');
  if (from > to) throw new Error('--from doit précéder --to');
  for (const range of splitByMonth({ from, to })) {
    await syncMatomoStats(range);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
