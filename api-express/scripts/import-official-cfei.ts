import fs from 'fs-extra';
import path from 'path';
import { parse } from 'csv-parse';
import prisma from '~/prisma';

/**
 * Import script for official CFEI (Chasseur Formé à l'Examen Initial) list.
 *
 * Usage: npx tsx scripts/import-official-cfei.ts path/to/cfei-list.csv
 *
 * Expected CSV columns:
 * - numero_cfei: CFEI number (required, used as primary key)
 * - nom: Last name (optional)
 * - prenom: First name (optional)
 * - departement: Department code (optional)
 */

async function importOfficialCfei() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-official-cfei.ts <path-to-csv>');
    console.error('Expected CSV columns: numero_cfei, nom, prenom, departement');
    process.exit(1);
  }

  const sourcePath = path.resolve(csvPath);

  if (!fs.existsSync(sourcePath)) {
    console.error(`CSV file not found at: ${sourcePath}`);
    process.exit(1);
  }

  console.log(`Reading CSV from: ${sourcePath}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const records: Array<{
    numero_cfei: string;
    nom: string | null;
    prenom: string | null;
    departement: string | null;
  }> = [];

  // Read all records first
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(sourcePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }),
      )
      .on('data', (row) => {
        const numeroCfei = row.numero_cfei?.trim();
        if (!numeroCfei) {
          skipped++;
          return;
        }

        records.push({
          numero_cfei: numeroCfei.toUpperCase(),
          nom: row.nom?.trim() || null,
          prenom: row.prenom?.trim() || null,
          departement: row.departement?.trim() || null,
        });
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve();
      });
  });

  console.log(`Found ${records.length} valid records to process`);

  // Process records in batches for better performance
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    for (const record of batch) {
      try {
        const existing = await prisma.officialCfei.findUnique({
          where: { numero_cfei: record.numero_cfei },
        });

        if (existing) {
          await prisma.officialCfei.update({
            where: { numero_cfei: record.numero_cfei },
            data: {
              nom: record.nom,
              prenom: record.prenom,
              departement: record.departement,
            },
          });
          updated++;
        } else {
          await prisma.officialCfei.create({
            data: record,
          });
          created++;
        }
      } catch (err) {
        console.error(`Error processing ${record.numero_cfei}:`, err);
        errors++;
      }
    }

    // Log progress
    const processed = Math.min(i + batchSize, records.length);
    console.log(`Processed ${processed}/${records.length} records...`);
  }

  console.log('\n--- Import Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no numero_cfei): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${created + updated}`);

  await prisma.$disconnect();
}

importOfficialCfei().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
