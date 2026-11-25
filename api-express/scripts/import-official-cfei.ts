import fs from 'fs-extra';
import path from 'path';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { extractOfficialCfeisFromSheet, type OfficialCfeiRecord } from '~/utils/official-cfei-sheet';

/**
 * Import de la liste officielle des personnes formées à l'examen initial (CFEI / FREI).
 *
 * Usage : npx tsx scripts/import-official-cfei.ts chemin/vers/liste.xlsx [--dry-run]
 *
 * Le fichier est l'export .xlsx du Google Sheet « Liste des personnes formées » (Fichier >
 * Télécharger > Microsoft Excel). Tous les onglets sont lus ; pour chacun, la ligne d'en-tête et les
 * colonnes numéro / nom / prénom / département sont repérées (cf extractOfficialCfeisFromSheet).
 * Les numéros sont stockés sous leur forme canonique (cf canonicalNumeroCfei) et upsertés : un
 * numéro présent dans plusieurs onglets (onglet régional + onglet départemental) n'est écrit
 * qu'une fois, avec les données du dernier onglet qui le contient.
 *
 * --dry-run : affiche le récapitulatif sans rien écrire en base.
 */

const BATCH_SIZE = 1000;

async function readSheets(xlsxPath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  return workbook.worksheets.map((worksheet) => {
    const rows: Array<Array<string>> = [];
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Array<string> = [];
      for (let column = 1; column <= row.cellCount; column++) {
        cells.push(row.getCell(column).text ?? '');
      }
      rows[rowNumber - 1] = cells;
    });
    return { name: worksheet.name, rows: Array.from(rows, (row) => row ?? []) };
  });
}

async function upsertBatch(batch: Array<OfficialCfeiRecord>) {
  const values = batch.map(
    (r) => Prisma.sql`(${r.numero_cfei}, ${r.nom}, ${r.prenom}, ${r.departement}, now(), now())`
  );
  const rows = await prisma.$queryRaw<Array<{ inserted: boolean }>>`
    INSERT INTO "OfficialCfei" (numero_cfei, nom, prenom, departement, created_at, updated_at)
    VALUES ${Prisma.join(values)}
    ON CONFLICT (numero_cfei) DO UPDATE
      SET nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, departement = EXCLUDED.departement, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `;
  const created = rows.filter((row) => row.inserted).length;
  return { created, updated: rows.length - created };
}

async function importOfficialCfei() {
  const xlsxPath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!xlsxPath || !xlsxPath.endsWith('.xlsx')) {
    console.error('Usage: npx tsx scripts/import-official-cfei.ts <chemin-vers-liste.xlsx> [--dry-run]');
    process.exit(1);
  }
  const sourcePath = path.resolve(xlsxPath);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Fichier introuvable : ${sourcePath}`);
    process.exit(1);
  }

  console.log(`Lecture de ${sourcePath}${dryRun ? ' (dry-run, rien ne sera écrit)' : ''}\n`);
  const sheets = await readSheets(sourcePath);

  const byNumero = new Map<string, OfficialCfeiRecord>();
  let extracted = 0;
  console.log('--- Récapitulatif par onglet ---');
  for (const sheet of sheets) {
    const result = extractOfficialCfeisFromSheet(sheet.name, sheet.rows);
    for (const record of result.records) byNumero.set(record.numero_cfei, record);
    extracted += result.records.length;
    const skipped = Object.entries(result.skipped)
      .map(([reason, count]) => `${count} ${reason}`)
      .join(', ');
    console.log(
      `${sheet.name} : ${result.rowsRead} lues, ${result.records.length} importées` +
        (skipped ? `, ignorées : ${skipped}` : '') +
        (result.error ? ` — ONGLET IGNORÉ : ${result.error}` : '')
    );
  }

  const records = Array.from(byNumero.values());
  console.log(`\n${sheets.length} onglets, ${extracted} numéros lus, ${records.length} numéros distincts`);

  if (dryRun) {
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const result = await upsertBatch(records.slice(i, i + BATCH_SIZE));
    created += result.created;
    updated += result.updated;
    console.log(`${Math.min(i + BATCH_SIZE, records.length)}/${records.length} écrits...`);
  }

  console.log('\n--- Import ---');
  console.log(`Créés : ${created}`);
  console.log(`Mis à jour : ${updated}`);

  await prisma.$disconnect();
}

importOfficialCfei().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
