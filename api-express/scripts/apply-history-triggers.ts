import fs from 'fs';
import path from 'path';
import prisma from '~/prisma';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma/migrations');
const FONCTION = /CREATE OR REPLACE FUNCTION \w+\(\) RETURNS trigger[\s\S]*?\$\$;/g;
const TRIGGER = /CREATE TRIGGER (\w+) (?:AFTER|BEFORE) [\s\S]*? ON ("\w+")[\s\S]*?;/g;

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
