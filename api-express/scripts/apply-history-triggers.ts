import fs from 'fs';
import path from 'path';
import prisma from '~/prisma';

// La base e2e est créée par `prisma db push`, qui ignore le SQL des migrations : les fonctions et triggers
// d'historique (migration history_tables et suivantes) n'y existent pas. On les rejoue ici, dans l'ordre des
// migrations, pour que les tables <Table>History se remplissent en e2e comme en production.
// lancé depuis api-express/, comme populate-test-db.ts
const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma/migrations');
const FONCTION = /CREATE OR REPLACE FUNCTION history_trigger_\w+\(\)[\s\S]*?\$\$;/g;
const TRIGGER = /CREATE TRIGGER (\w+) AFTER [\s\S]*? ON ("\w+")[\s\S]*?;/g;

export async function applyHistoryTriggers() {
  const migrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => fs.existsSync(path.join(MIGRATIONS_DIR, name, 'migration.sql')))
    .sort();
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8');
    for (const [fonction] of sql.matchAll(FONCTION)) {
      await prisma.$executeRawUnsafe(fonction);
    }
    for (const [trigger, name, table] of sql.matchAll(TRIGGER)) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
      await prisma.$executeRawUnsafe(trigger);
    }
  }
}
