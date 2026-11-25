import { EntityTypes, FeiOwnerRole, PrismaClient, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import prismaClient from '~/prisma';
import {
  findScopeCarcassesPage,
  getCarcasseAccessWhere,
  getCarcasseScopeBranches,
} from '~/utils/carcasse-access';

// getCarcasseScopeBranches réécrit en SQL brut le périmètre de getCarcasseAccessWhere. Ici, sur une
// vraie base, les deux doivent renvoyer les mêmes carcasses dans le même ordre, page après page, pour
// chaque rôle. En CI, VITEST_DB_URL pointe sur la base du job `checks` ; en local, le test est sauté
// sauf si VITEST_DB_URL est posée sur une base jetable (il y écrit puis supprime ses lignes).
const VITEST_DB_URL = process.env.VITEST_DB_URL;

// Une seule connexion : le fuseau posé par SET en beforeAll vaut pour toutes les requêtes du test,
// sans toucher la base partagée avec les autres fichiers de test.
vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  if (!process.env.VITEST_DB_URL) return { default: new Client() };
  const url = new URL(process.env.VITEST_DB_URL);
  url.searchParams.set('connection_limit', '1');
  return { default: new Client({ datasourceUrl: url.toString() }) };
});

const PREFIX = 'scope-db-test-';
const id = (suffix: string) => `${PREFIX}${suffix}`;
const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

type Row = {
  ms: number;
  ci?: Array<'E1' | 'E2' | 'AUTRE'>;
  next?: string;
  current?: string;
  prev?: string;
  svi?: string;
  sviAssigned?: boolean;
  premierDetenteurEntity?: string;
  role?: FeiOwnerRole;
  userField?:
    | 'premier_detenteur_user_id'
    | 'examinateur_initial_user_id'
    | 'next_owner_user_id'
    | 'prev_owner_user_id'
    | 'current_owner_user_id';
  deleted?: boolean;
};

const ROWS: Record<string, Row> = {
  'ci-e1': { ms: 10, ci: ['E1'] },
  'ci-e2': { ms: 20, ci: ['E2'] },
  'next-e1': { ms: 30, next: 'E1' },
  'current-e2': { ms: 40, current: 'E2' },
  'les-trois': { ms: 50, ci: ['E1'], next: 'E2', current: 'E1' },
  autre: { ms: 60, ci: ['AUTRE'], next: 'AUTRE', current: 'AUTRE', prev: 'AUTRE', svi: 'AUTRE' },
  supprimee: { ms: 70, ci: ['E1'], current: 'E1', svi: 'E1', sviAssigned: true, deleted: true },
  // même updated_at : l'id départage
  'egalite-a': { ms: 80, ci: ['E1'] },
  'egalite-b': { ms: 80, next: 'E2' },
  'egalite-c': { ms: 80, current: 'E1' },
  'ci-autre-current-e1': { ms: 90, ci: ['AUTRE'], current: 'E1' },
  'ci-e1-et-e2': { ms: 100, ci: ['E1', 'E2'] },
  'svi-e1': { ms: 110, svi: 'E1', sviAssigned: true },
  'svi-e2-non-assignee': { ms: 120, svi: 'E2' },
  'next-e2-svi': { ms: 130, next: 'E2', sviAssigned: true },
  'pd-e1-transmise': { ms: 140, premierDetenteurEntity: 'E1', role: FeiOwnerRole.PREMIER_DETENTEUR },
  'pd-e1-examinateur': { ms: 150, premierDetenteurEntity: 'E1', role: FeiOwnerRole.EXAMINATEUR_INITIAL },
  'pd-e2-sans-role': { ms: 160, premierDetenteurEntity: 'E2' },
  'next-e1-examinateur': { ms: 170, next: 'E1', role: FeiOwnerRole.EXAMINATEUR_INITIAL },
  'prev-e2': { ms: 180, prev: 'E2' },
  'user-examinateur': { ms: 190, userField: 'examinateur_initial_user_id' },
  'user-premier-detenteur': { ms: 200, userField: 'premier_detenteur_user_id' },
  'user-next': { ms: 210, userField: 'next_owner_user_id' },
  'user-prev': { ms: 220, userField: 'prev_owner_user_id' },
  'user-current': { ms: 230, userField: 'current_owner_user_id' },
  'svi-autre': { ms: 240, svi: 'AUTRE', sviAssigned: true },
  'svi-e2': { ms: 250, svi: 'E2', sviAssigned: true },
  'next-e2-transmise': { ms: 260, next: 'E2', role: FeiOwnerRole.PREMIER_DETENTEUR },
  // deux passages par la même entité : une seule fois dans le pull. Sans dédoublonnage avant le LIMIT
  // de la branche, la page de 2 lignes serait ce doublon, et ci-e2-juste-apres serait sautée.
  'ci-e2-juste-apres': { ms: 265, ci: ['E2'] },
  'ci-e1-deux-fois': { ms: 270, ci: ['E1', 'E1'] },
};

const userId = id('user');
const users = {
  ETG: { id: userId, roles: [UserRoles.ETG] } as User,
  SVI: { id: userId, roles: [UserRoles.SVI] } as User,
  CHASSEUR: { id: userId, roles: [UserRoles.CHASSEUR] } as User,
};

describe.skipIf(!VITEST_DB_URL)('périmètre des carcasses en SQL brut sur une vraie base', () => {
  const prisma = prismaClient as unknown as PrismaClient;
  const entityIds = [id('E1'), id('E2')];

  async function cleanup() {
    await prisma.carcasseIntermediaire.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.carcasse.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.fei.deleteMany({ where: { numero: { startsWith: PREFIX } } });
    await prisma.entity.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    // Les triggers viennent des migrations : la base doit être créée par `prisma migrate deploy`.
    // Fuseau de session différent d'UTC : les bornes de dates du SQL brut doivent rester justes.
    await prisma.$executeRawUnsafe(`SET timezone TO 'Pacific/Auckland'`);
    const [{ timezone }] = await prisma.$queryRaw<
      Array<{ timezone: string }>
    >`SELECT current_setting('TimeZone') AS timezone`;
    expect(timezone).toBe('Pacific/Auckland');

    await cleanup();
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.fr` } });
    await prisma.entity.createMany({
      data: ['E1', 'E2', 'AUTRE'].map((suffix) => ({
        id: id(suffix),
        type: EntityTypes.ETG,
        raison_sociale: id(suffix),
      })),
    });
    await prisma.fei.create({ data: { numero: id('FEI'), created_by_user_id: userId } });

    const entity = (suffix: string | undefined) => (suffix ? id(suffix) : null);
    for (const [suffix, row] of Object.entries(ROWS)) {
      await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id: id(suffix),
          numero_bracelet: suffix,
          fei_numero: id('FEI'),
          next_owner_entity_id: entity(row.next),
          current_owner_entity_id: entity(row.current),
          prev_owner_entity_id: entity(row.prev),
          svi_entity_id: entity(row.svi),
          svi_assigned_at: row.sviAssigned ? at(row.ms) : null,
          premier_detenteur_entity_id: entity(row.premierDetenteurEntity),
          current_owner_role: row.role ?? null,
          ...(row.userField ? { [row.userField]: userId } : {}),
          deleted_at: row.deleted ? at(row.ms) : null,
        },
      });
      for (const [index, ciEntity] of (row.ci ?? []).entries()) {
        await prisma.carcasseIntermediaire.create({
          data: {
            fei_numero: id('FEI'),
            numero_bracelet: suffix,
            zacharie_carcasse_id: id(suffix),
            intermediaire_id: id(`${suffix}-${ciEntity}-${index}`),
            intermediaire_entity_id: id(ciEntity),
            intermediaire_user_id: userId,
          },
        });
      }
      // updated_at posé en dernier : @updatedAt l'écraserait à chaque écriture Prisma. Le trigger
      // carcasse_updated_at_to_intermediaires le recopie sur les CarcasseIntermediaire.
      await prisma.$executeRaw`UPDATE "Carcasse" SET updated_at = ${at(row.ms)} WHERE zacharie_carcasse_id = ${id(suffix)}`;
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  type Options = { includeDeleted: boolean; afterDate: Date | undefined };

  async function allPagesFromRawSql(user: User, options: Options) {
    const branches = getCarcasseScopeBranches(user, entityIds)!;
    const ids: Array<string> = [];
    let cursor: { updatedAt: Date; id: string } | undefined;
    for (;;) {
      const { carcasses, hasMore } = await findScopeCarcassesPage({ branches, ...options, cursor, limit: 2 });
      // seulement les carcasses du test : la base peut en contenir d'autres
      ids.push(
        ...carcasses
          .map((carcasse) => carcasse.zacharie_carcasse_id)
          .filter((carcasseId) => carcasseId.startsWith(PREFIX))
      );
      if (!hasMore) return ids;
      const last = carcasses.at(-1)!;
      cursor = { updatedAt: last.updated_at, id: last.zacharie_carcasse_id };
    }
  }

  async function allFromAccessWhere(user: User, options: Options) {
    const accessWhere = (await getCarcasseAccessWhere(user, entityIds))!;
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

  const roles = Object.keys(users) as Array<keyof typeof users>;
  const optionsList: Array<Options> = [
    { includeDeleted: false, afterDate: undefined },
    { includeDeleted: true, afterDate: undefined },
    { includeDeleted: true, afterDate: at(40) },
    { includeDeleted: false, afterDate: at(80) },
  ];

  test.each(roles.flatMap((role) => optionsList.map((options) => ({ role, ...options }))))(
    '$role : mêmes carcasses, même ordre (includeDeleted=$includeDeleted, afterDate=$afterDate)',
    async ({ role, ...options }) => {
      const expected = await allFromAccessWhere(users[role], options);
      expect(expected.length).toBeGreaterThan(2);
      expect(await allPagesFromRawSql(users[role], options)).toEqual(expected);
    }
  );

  test.each([
    [
      'ETG' as const,
      [
        'ci-e1-deux-fois',
        'ci-e2-juste-apres',
        'next-e2-transmise',
        'next-e1-examinateur',
        'next-e2-svi',
        'ci-e1-et-e2',
        'ci-autre-current-e1',
        'egalite-c',
        'egalite-b',
        'egalite-a',
        'les-trois',
        'current-e2',
        'next-e1',
        'ci-e2',
        'ci-e1',
      ],
    ],
    ['SVI' as const, ['svi-e2', 'next-e2-svi', 'svi-e1']],
    [
      'CHASSEUR' as const,
      [
        'next-e2-transmise',
        'user-current',
        'user-prev',
        'user-next',
        'user-premier-detenteur',
        'user-examinateur',
        'prev-e2',
        'pd-e1-transmise',
        'ci-autre-current-e1',
        'egalite-c',
        'les-trois',
        'current-e2',
      ],
    ],
  ])('%s : périmètre attendu, sans doublon ni carcasse d’une autre entité', async (role, expected) => {
    expect(await allPagesFromRawSql(users[role], { includeDeleted: false, afterDate: undefined })).toEqual(
      expected.map(id)
    );
  });

  // En dernier : modifie des lignes partagées par les tests précédents.
  describe('copie de Carcasse.updated_at sur CarcasseIntermediaire (triggers)', () => {
    async function intermediaires(suffix: string) {
      return prisma.carcasseIntermediaire.findMany({ where: { zacharie_carcasse_id: id(suffix) } });
    }
    async function historyCount() {
      return prisma.carcasseIntermediaireHistory.count({ where: { fei_numero: id('FEI') } });
    }

    test('une mise à jour de carcasse recopie sa date, sans écrire dans l’historique', async () => {
      const historyBefore = await historyCount();
      const carcasse = await prisma.carcasse.update({
        where: { zacharie_carcasse_id: id('ci-e1-et-e2') },
        data: { heure_evisceration: '12:00' },
      });
      const rows = await intermediaires('ci-e1-et-e2');
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.carcasse_updated_at).toEqual(carcasse.updated_at);
      }
      expect(await historyCount()).toBe(historyBefore);
    });

    test('la date envoyée par l’application est ignorée : toujours celle de la carcasse', async () => {
      const carcasse = await prisma.carcasse.findUniqueOrThrow({
        where: { zacharie_carcasse_id: id('ci-e2') },
      });
      const created = await prisma.carcasseIntermediaire.create({
        data: {
          fei_numero: id('FEI'),
          numero_bracelet: 'ci-e2',
          zacharie_carcasse_id: id('ci-e2'),
          intermediaire_id: id('ci-e2-nouvel-intermediaire'),
          intermediaire_entity_id: id('E1'),
          intermediaire_user_id: userId,
          carcasse_updated_at: new Date(0),
        },
      });
      expect(created.carcasse_updated_at).toEqual(carcasse.updated_at);

      const updated = await prisma.carcasseIntermediaire.update({
        where: {
          fei_numero_zacharie_carcasse_id_intermediaire_id: {
            fei_numero: id('FEI'),
            zacharie_carcasse_id: id('ci-e2'),
            intermediaire_id: id('ci-e2-nouvel-intermediaire'),
          },
        },
        data: { carcasse_updated_at: new Date(0) },
      });
      expect(updated.carcasse_updated_at).toEqual(carcasse.updated_at);
    });
  });
});
