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
