import { EntityTypes, PrismaClient, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import prismaClient from '~/prisma';
import { findIntermediaireScopeCarcassesPage, getCarcasseAccessWhere } from '~/utils/carcasse-access';

// findIntermediaireScopeCarcassesPage réécrit en SQL brut le périmètre intermédiaire de
// getCarcasseAccessWhere. Ici, sur une vraie base, les deux doivent renvoyer les mêmes carcasses dans
// le même ordre, page après page. En CI, VITEST_DB_URL pointe sur la base du job `checks` ; en local,
// le test est sauté sauf si VITEST_DB_URL est posée sur une base jetable (il y écrit puis supprime ses lignes).
const VITEST_DB_URL = process.env.VITEST_DB_URL;

vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return { default: new Client({ datasourceUrl: process.env.VITEST_DB_URL }) };
});

const PREFIX = 'scope-db-test-';
const id = (suffix: string) => `${PREFIX}${suffix}`;
const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

describe.skipIf(!VITEST_DB_URL)('périmètre intermédiaire en SQL brut sur une vraie base', () => {
  const prisma = prismaClient as unknown as PrismaClient;
  const entityIds = [id('E1'), id('E2')];
  const etgUser = { id: id('user'), roles: [UserRoles.ETG] } as User;
  let databaseName: string;

  async function cleanup() {
    await prisma.carcasseIntermediaire.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.carcasse.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.fei.deleteMany({ where: { numero: { startsWith: PREFIX } } });
    await prisma.entity.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    // Fuseau de session différent d'UTC : les bornes de dates du SQL brut doivent rester justes.
    // Posé sur la base avant la première connexion du client.
    const admin = new PrismaClient({ datasourceUrl: VITEST_DB_URL });
    const [{ current_database }] = await admin.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;
    databaseName = current_database;
    await admin.$executeRawUnsafe(`ALTER DATABASE "${databaseName}" SET timezone TO 'Pacific/Auckland'`);
    await admin.$disconnect();

    await cleanup();
    await prisma.user.create({ data: { id: etgUser.id, email: `${etgUser.id}@example.fr` } });
    await prisma.entity.createMany({
      data: ['E1', 'E2', 'AUTRE'].map((suffix) => ({
        id: id(suffix),
        type: EntityTypes.ETG,
        raison_sociale: id(suffix),
      })),
    });
    await prisma.fei.create({ data: { numero: id('FEI'), created_by_user_id: etgUser.id } });

    // [suffixe, updated_at (ms), passée par CarcasseIntermediaire de, next_owner, current_owner, supprimée]
    const rows: Array<[string, number, string | null, string | null, string | null, boolean]> = [
      ['ci-e1', 10, 'E1', null, null, false],
      ['ci-e2', 20, 'E2', null, null, false],
      ['next-e1', 30, null, 'E1', null, false],
      ['current-e2', 40, null, null, 'E2', false],
      ['les-trois', 50, 'E1', 'E2', 'E1', false],
      ['autre', 60, 'AUTRE', 'AUTRE', 'AUTRE', false],
      ['supprimee', 70, 'E1', null, null, true],
      // même updated_at : l'id départage
      ['egalite-a', 80, 'E1', null, null, false],
      ['egalite-b', 80, null, 'E2', null, false],
      ['egalite-c', 80, null, null, 'E1', false],
      ['ci-autre-current-e1', 90, 'AUTRE', null, 'E1', false],
      ['ci-e1-et-e2', 100, 'E1', null, null, false],
    ];
    for (const [suffix, ms, ciEntity, next, current, deleted] of rows) {
      await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id: id(suffix),
          numero_bracelet: suffix,
          fei_numero: id('FEI'),
          next_owner_entity_id: next && id(next),
          current_owner_entity_id: current && id(current),
          deleted_at: deleted ? at(ms) : null,
        },
      });
      if (ciEntity) {
        const ciEntities = suffix === 'ci-e1-et-e2' ? ['E1', 'E2'] : [ciEntity];
        for (const entity of ciEntities) {
          await prisma.carcasseIntermediaire.create({
            data: {
              fei_numero: id('FEI'),
              numero_bracelet: suffix,
              zacharie_carcasse_id: id(suffix),
              intermediaire_id: id(`${suffix}-${entity}`),
              intermediaire_entity_id: id(entity),
              intermediaire_user_id: etgUser.id,
            },
          });
        }
      }
      // updated_at posé en dernier : @updatedAt l'écraserait à chaque écriture Prisma
      await prisma.$executeRaw`UPDATE "Carcasse" SET updated_at = ${at(ms)} WHERE zacharie_carcasse_id = ${id(suffix)}`;
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$executeRawUnsafe(`ALTER DATABASE "${databaseName}" RESET timezone`);
    await prisma.$disconnect();
  });

  async function allPagesFromRawSql(options: { includeDeleted: boolean; afterDate: Date | undefined }) {
    const ids: Array<string> = [];
    let cursor: { updatedAt: Date; id: string } | undefined;
    for (;;) {
      const page = await findIntermediaireScopeCarcassesPage({ entityIds, ...options, cursor, limit: 2 });
      ids.push(...page.map((carcasse) => carcasse.zacharie_carcasse_id));
      if (page.length < 2) return ids;
      const last = page.at(-1)!;
      cursor = { updatedAt: last.updated_at, id: last.zacharie_carcasse_id };
    }
  }

  async function allFromAccessWhere(options: { includeDeleted: boolean; afterDate: Date | undefined }) {
    const accessWhere = (await getCarcasseAccessWhere(etgUser, entityIds))!;
    const carcasses = await prisma.carcasse.findMany({
      where: {
        ...accessWhere,
        fei_numero: id('FEI'),
        ...(options.includeDeleted ? {} : { deleted_at: null }),
        ...(options.afterDate ? { updated_at: { gte: options.afterDate } } : {}),
      },
      orderBy: [{ updated_at: 'desc' }, { zacharie_carcasse_id: 'desc' }],
    });
    return carcasses.map((carcasse) => carcasse.zacharie_carcasse_id);
  }

  test.each([
    { includeDeleted: false, afterDate: undefined },
    { includeDeleted: true, afterDate: undefined },
    { includeDeleted: true, afterDate: at(40) },
    { includeDeleted: false, afterDate: at(80) },
  ])(
    'mêmes carcasses, même ordre (includeDeleted=$includeDeleted, afterDate=$afterDate)',
    async (options) => {
      const expected = await allFromAccessWhere(options);
      expect(expected.length).toBeGreaterThan(2);
      expect(await allPagesFromRawSql(options)).toEqual(expected);
    }
  );

  test('périmètre attendu, sans doublon ni carcasse d’une autre entité', async () => {
    expect(await allPagesFromRawSql({ includeDeleted: false, afterDate: undefined })).toEqual([
      id('ci-e1-et-e2'),
      id('ci-autre-current-e1'),
      id('egalite-c'),
      id('egalite-b'),
      id('egalite-a'),
      id('les-trois'),
      id('current-e2'),
      id('next-e1'),
      id('ci-e2'),
      id('ci-e1'),
    ]);
  });
});
