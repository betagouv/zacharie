import pg from 'pg';
import type { Page } from '@playwright/test';

export const BAC_A_SABLE_URL = 'http://localhost:3292';
const PGBASEURL = process.env.PGBASEURL ?? 'postgres://postgres:postgres@localhost:5432';
const DATABASE = 'zacharie-api-playground-test';

export async function resetBacASable() {
  const admin = new pg.Client({ connectionString: `${PGBASEURL}/postgres` });
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DATABASE]);
  if (!existing.rowCount) await admin.query(`CREATE DATABASE "${DATABASE}"`);
  await admin.end();

  const client = new pg.Client({ connectionString: `${PGBASEURL}/${DATABASE}` });
  await client.connect();
  await client.query(`
    DO $$ BEGIN
      IF to_regclass('public.users') IS NOT NULL THEN TRUNCATE users CASCADE; END IF;
    END $$;
  `);
  await client.end();
}

export async function gotoBacASable(page: Page, path: string) {
  await page.goto(`${BAC_A_SABLE_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await page.locator('html[data-hydrated="true"]').waitFor();
}
