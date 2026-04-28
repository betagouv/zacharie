import { EntityTypes } from '@prisma/client';
import prisma from '~/prisma';
import departementsRegions from '~/data/departements-regions.json';

/**
 * Seed des Entity FDC (1 par département), FRC (1 par région) et FNC (1 nationale).
 * Idempotent : ré-exécutable, vérifie l'existence par `nom_d_usage` avant création.
 *
 * Usage : npx tsx scripts/seed-federations.ts
 */

type Mapping = {
  regions: Record<string, string>;
  departements: Record<string, string>;
  departementToRegion: Record<string, string>;
};

async function seedFederations() {
  const mapping = departementsRegions as Mapping;
  let createdFdc = 0;
  let createdFrc = 0;
  let createdFnc = 0;
  let skipped = 0;

  // FDC : 1 par département
  for (const [code, nom] of Object.entries(mapping.departements)) {
    const nomUsage = `FDC ${code} — ${nom}`;
    const existing = await prisma.entity.findFirst({
      where: { type: EntityTypes.FDC, nom_d_usage: nomUsage },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.entity.create({
      data: {
        type: EntityTypes.FDC,
        nom_d_usage: nomUsage,
        raison_sociale: `Fédération Départementale des Chasseurs ${nom}`,
        scope_departements_codes: [code],
        zacharie_compatible: true,
      },
    });
    createdFdc++;
  }

  // FRC : 1 par région, scope = tous les depts de la région
  const departementsByRegion = new Map<string, string[]>();
  for (const [dept, region] of Object.entries(mapping.departementToRegion)) {
    if (!departementsByRegion.has(region)) departementsByRegion.set(region, []);
    departementsByRegion.get(region)!.push(dept);
  }

  for (const [regionSlug, regionNom] of Object.entries(mapping.regions)) {
    const depts = departementsByRegion.get(regionSlug) ?? [];
    const nomUsage = `FRC ${regionSlug} — ${regionNom}`;
    const existing = await prisma.entity.findFirst({
      where: { type: EntityTypes.FRC, nom_d_usage: nomUsage },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.entity.create({
      data: {
        type: EntityTypes.FRC,
        nom_d_usage: nomUsage,
        raison_sociale: `Fédération Régionale des Chasseurs ${regionNom}`,
        scope_departements_codes: depts,
        zacharie_compatible: true,
      },
    });
    createdFrc++;
  }

  // FNC : 1 nationale, scope vide = tous les départements
  const fncNom = 'FNC — Fédération Nationale des Chasseurs';
  const fncExisting = await prisma.entity.findFirst({
    where: { type: EntityTypes.FNC, nom_d_usage: fncNom },
    select: { id: true },
  });
  if (fncExisting) {
    skipped++;
  } else {
    await prisma.entity.create({
      data: {
        type: EntityTypes.FNC,
        nom_d_usage: fncNom,
        raison_sociale: 'Fédération Nationale des Chasseurs',
        scope_departements_codes: [],
        zacharie_compatible: true,
      },
    });
    createdFnc++;
  }

  console.log('--- Seed Fédérations ---');
  console.log(`FDC créées : ${createdFdc}`);
  console.log(`FRC créées : ${createdFrc}`);
  console.log(`FNC créée  : ${createdFnc}`);
  console.log(`Existantes (skip) : ${skipped}`);

  await prisma.$disconnect();
}

seedFederations().catch((err) => {
  console.error('Seed Fédérations échoué :', err);
  process.exit(1);
});
