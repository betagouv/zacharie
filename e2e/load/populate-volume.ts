// Test de charge : remplit la base de test avec un gros volume pour ETG 1.
// Part du seed SVI_CLOSED (une fiche clôturée de 4 carcasses passée par ETG 1) et la duplique en SQL.
//
// Usage (API de test lancée sur 3291) :
//   CARCASSES=1000000 npx tsx load/populate-volume.ts
import pg from 'pg';

const CARCASSES = Number(process.env.CARCASSES ?? 10000);
const BATCH_FEIS = 20000;
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/zacharietest';

if (!DATABASE_URL.endsWith('/zacharietest')) {
  throw new Error('Ce script ne tourne que sur la base zacharietest');
}

// décale les dates d'une copie : jusqu'à 3 ans en arrière pour les dates de chasse, quelques
// secondes par copie pour created_at/updated_at (ordre stable pour la pagination)
const shift = (column: string) => `'${column}', c.${column} - make_interval(secs => g)`;
const shiftDays = (column: string) => `'${column}', c.${column} - (g % 1095)`;

async function main() {
  const reset = await fetch('http://localhost:3291/__e2e/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'SVI_CLOSED' }),
  });
  if (!reset.ok) throw new Error(`reset SVI_CLOSED: ${reset.status}`);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ numero: string; carcasses: string }>(
    `SELECT f.numero, (SELECT count(*) FROM "Carcasse" c WHERE c.fei_numero = f.numero) AS carcasses FROM "Fei" f`
  );
  if (rows.length !== 1) throw new Error(`le seed SVI_CLOSED doit avoir une seule fiche (${rows.length})`);
  const template = rows[0].numero;
  const carcassesParFiche = Number(rows[0].carcasses);
  const copies = Math.ceil(CARCASSES / carcassesParFiche) - 1;
  console.log(`modèle ${template} (${carcassesParFiche} carcasses) × ${copies} copies`);

  const started = Date.now();
  for (let from = 1; from <= copies; from += BATCH_FEIS) {
    const to = Math.min(copies, from + BATCH_FEIS - 1);
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO "Fei"
       SELECT r.* FROM "Fei" c, generate_series($2::int, $3::int) g,
       LATERAL jsonb_populate_record(NULL::"Fei", to_jsonb(c) || jsonb_build_object(
         'id', nextval(pg_get_serial_sequence('"Fei"', 'id')),
         'numero', c.numero || '-' || g,
         ${shiftDays('date_mise_a_mort')}, ${shift('created_at')}, ${shift('updated_at')}
       )) r
       WHERE c.numero = $1`,
      [template, from, to]
    );
    await client.query(
      `INSERT INTO "Carcasse"
       SELECT r.* FROM "Carcasse" c, generate_series($2::int, $3::int) g,
       LATERAL jsonb_populate_record(NULL::"Carcasse", to_jsonb(c) || jsonb_build_object(
         'zacharie_carcasse_id', c.fei_numero || '-' || g || '_' || c.numero_bracelet,
         'fei_numero', c.fei_numero || '-' || g,
         ${shiftDays('date_mise_a_mort')}, ${shift('created_at')}, ${shift('updated_at')}
       )) r
       WHERE c.fei_numero = $1`,
      [template, from, to]
    );
    await client.query(
      `INSERT INTO "CarcasseIntermediaire"
       SELECT r.* FROM "CarcasseIntermediaire" c, generate_series($2::int, $3::int) g,
       LATERAL jsonb_populate_record(NULL::"CarcasseIntermediaire", to_jsonb(c) || jsonb_build_object(
         'zacharie_carcasse_id', c.fei_numero || '-' || g || '_' || substring(c.zacharie_carcasse_id from length(c.fei_numero) + 2),
         'fei_numero', c.fei_numero || '-' || g,
         ${shift('created_at')}, ${shift('updated_at')}
       )) r
       WHERE c.fei_numero = $1`,
      [template, from, to]
    );
    await client.query('COMMIT');
    console.log(`  fiches ${to}/${copies} (${Math.round((Date.now() - started) / 1000)} s)`);
  }

  const counts = await client.query(
    `SELECT (SELECT count(*) FROM "Fei") AS feis, (SELECT count(*) FROM "Carcasse") AS carcasses,
            (SELECT count(*) FROM "CarcasseIntermediaire") AS intermediaires`
  );
  console.log(counts.rows[0]);
  await client.query('ANALYZE');
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
