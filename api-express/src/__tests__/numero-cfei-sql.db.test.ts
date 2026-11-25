import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { describe, test, expect, afterAll } from 'vitest';
import { canonicalNumeroCfei } from '~/utils/numero-cfei';

// La fonction SQL du script de rattrapage doit donner la même forme canonique que canonicalNumeroCfei.
// En CI, VITEST_DB_URL pointe sur la base du job `checks` ; en local, le test est sauté sans VITEST_DB_URL.
const VITEST_DB_URL = process.env.VITEST_DB_URL;

const SQL_SCRIPT = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/20261125_canonical_numero_cfei.sql'),
  'utf8'
);
const CREATE_FUNCTION = SQL_SCRIPT.match(/CREATE FUNCTION pg_temp\.canonical_numero_cfei[\s\S]*?\$\$;/)![0];

const CAS = [
  'CFEI-45-13-577',
  'cfei-045-13-00577',
  ' CFEI 45 13 0577 ',
  'CFEI45-13-577',
  'CFEI/45/13/577',
  'cfei_45_13_577',
  'CFEI‐19‐12‐0345',
  'CFEI–19−12—0345',
  'CFEI 45-13-0577',
  'CFEI-45-13-0577 ',
  'CFEI 45-13-0577',
  '﻿CFEI-45-13-0577',
  'CFEI-5-14-0012',
  'CFEI-971-20-0001',
  'CFEI-02A-15-0042',
  '83-07-132',
  '32-FREI-20-002',
  '32‑frei‑20‑002',
  '02A-FREI-20-002',
  'CFEI-21-09-0 5',
  'CFEI-21-09-02 045',
  'en cours',
  'ABC-12',
  '--',
  '',
];

describe.skipIf(!VITEST_DB_URL)('script SQL 20261125_canonical_numero_cfei', () => {
  const prisma = new PrismaClient({ datasourceUrl: VITEST_DB_URL });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('la fonction SQL donne la même forme canonique que canonicalNumeroCfei', async () => {
    // pg_temp est propre à une connexion : création et appels dans la même transaction
    const resultats = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(CREATE_FUNCTION);
      const sortie: Array<string> = [];
      for (const cas of CAS) {
        const [{ canonique }] = await tx.$queryRaw<Array<{ canonique: string }>>`
          SELECT pg_temp.canonical_numero_cfei(${cas}) AS canonique
        `;
        sortie.push(canonique);
      }
      return sortie;
    });
    expect(resultats).toEqual(CAS.map(canonicalNumeroCfei));
  });
});
