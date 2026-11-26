import { EntityTypes, FeiOwnerRole, PrismaClient, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import prismaClient from '~/prisma';
import {
  findScopeCarcassesPage,
  getCarcasseAccessWhere,
  getCarcasseScopeBranches,
} from '~/utils/carcasse-access';

// Fiche répartie par le premier détenteur entre deux ETG (une branche de dispatch par destinataire).
// Chaque ETG ne reçoit et ne lit que les carcasses de sa branche : pull GET /carcasse (SQL brut),
// WHERE d'accès partagé par /carcasse/count, /carcasse/refusees/:fei_numero et les écritures /sync.
// Même mécanique que carcasse-scope.db.test.ts : sauté en local sauf si VITEST_DB_URL est posée.
const VITEST_DB_URL = process.env.VITEST_DB_URL;

vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  if (!process.env.VITEST_DB_URL) return { default: new Client() };
  return { default: new Client({ datasourceUrl: process.env.VITEST_DB_URL }) };
});

const PREFIX = 'dispatch-scope-test-';
const id = (suffix: string) => `${PREFIX}${suffix}`;
const FEI = id('FEI');
const ETG_1 = id('ETG-1');
const ETG_2 = id('ETG-2');
const PD = id('PD');

const etg1User = { id: id('user-etg-1'), roles: [UserRoles.ETG] } as User;
const etg2User = { id: id('user-etg-2'), roles: [UserRoles.ETG] } as User;

const BRANCHE_ETG_1 = [id('MM-001-003'), id('MM-001-004')];
const BRANCHE_ETG_2 = [id('MM-001-001'), id('MM-001-002')];

describe.skipIf(!VITEST_DB_URL)('dispatch entre deux ETG : chaque ETG ne voit que sa branche', () => {
  const prisma = prismaClient as unknown as PrismaClient;

  async function cleanup() {
    await prisma.carcasseIntermediaire.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.carcasse.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.fei.deleteMany({ where: { numero: { startsWith: PREFIX } } });
    await prisma.entity.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  }

  async function pull(user: User, entityId: string) {
    const branches = getCarcasseScopeBranches(user, [entityId])!;
    const { carcasses } = await findScopeCarcassesPage({
      branches,
      includeDeleted: false,
      afterDate: undefined,
      cursor: undefined,
      limit: 100,
    });
    return carcasses
      .map((carcasse) => carcasse.zacharie_carcasse_id)
      .filter((carcasseId) => carcasseId.startsWith(PREFIX))
      .sort();
  }

  async function readable(user: User, entityId: string) {
    const accessWhere = (await getCarcasseAccessWhere(user, [entityId]))!;
    const carcasses = await prisma.carcasse.findMany({
      where: { ...accessWhere, fei_numero: FEI },
      select: { zacharie_carcasse_id: true },
    });
    return carcasses.map((carcasse) => carcasse.zacharie_carcasse_id).sort();
  }

  beforeAll(async () => {
    await cleanup();
    await prisma.user.createMany({
      data: [PD, etg1User.id, etg2User.id].map((userId) => ({ id: userId, email: `${userId}@example.fr` })),
    });
    await prisma.entity.createMany({
      data: [ETG_1, ETG_2].map((entityId) => ({
        id: entityId,
        type: EntityTypes.ETG,
        raison_sociale: entityId,
      })),
    });
    await prisma.fei.create({ data: { numero: FEI, created_by_user_id: PD, premier_detenteur_user_id: PD } });

    // Le premier détenteur transmet : chaque carcasse porte le destinataire de sa branche.
    for (const [entityId, carcasseIds] of [
      [ETG_1, BRANCHE_ETG_1],
      [ETG_2, BRANCHE_ETG_2],
    ] as const) {
      for (const carcasseId of carcasseIds) {
        await prisma.carcasse.create({
          data: {
            zacharie_carcasse_id: carcasseId,
            numero_bracelet: carcasseId,
            fei_numero: FEI,
            premier_detenteur_user_id: PD,
            premier_detenteur_prochain_detenteur_id_cache: entityId,
            current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
            current_owner_user_id: PD,
            next_owner_role: FeiOwnerRole.ETG,
            next_owner_entity_id: entityId,
          },
        });
      }
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test('après la transmission : chaque ETG reçoit uniquement les carcasses de sa branche', async () => {
    expect(await pull(etg1User, ETG_1)).toEqual([...BRANCHE_ETG_1].sort());
    expect(await pull(etg2User, ETG_2)).toEqual([...BRANCHE_ETG_2].sort());
    expect(await readable(etg1User, ETG_1)).toEqual([...BRANCHE_ETG_1].sort());
    expect(await readable(etg2User, ETG_2)).toEqual([...BRANCHE_ETG_2].sort());
  });

  test("après la prise en charge par l'ETG 1 : l'ETG 1 ne reçoit toujours pas la branche de l'ETG 2", async () => {
    // Prise en charge par l'ETG 1 de ses seules carcasses (etg-current-owner-confirm.tsx).
    for (const carcasseId of BRANCHE_ETG_1) {
      await prisma.carcasseIntermediaire.create({
        data: {
          fei_numero: FEI,
          numero_bracelet: carcasseId,
          zacharie_carcasse_id: carcasseId,
          intermediaire_id: id(`${carcasseId}-ETG-1`),
          intermediaire_entity_id: ETG_1,
          intermediaire_user_id: etg1User.id,
          intermediaire_role: FeiOwnerRole.ETG,
        },
      });
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: carcasseId },
        data: {
          prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
          prev_owner_user_id: PD,
          current_owner_role: FeiOwnerRole.ETG,
          current_owner_entity_id: ETG_1,
          current_owner_user_id: etg1User.id,
          next_owner_role: null,
          next_owner_entity_id: null,
        },
      });
    }

    expect(await pull(etg1User, ETG_1)).toEqual([...BRANCHE_ETG_1].sort());
    expect(await pull(etg2User, ETG_2)).toEqual([...BRANCHE_ETG_2].sort());
    expect(await readable(etg1User, ETG_1)).toEqual([...BRANCHE_ETG_1].sort());
    expect(await readable(etg2User, ETG_2)).toEqual([...BRANCHE_ETG_2].sort());
  });
});
