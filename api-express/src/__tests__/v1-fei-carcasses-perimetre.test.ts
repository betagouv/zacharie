import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ApiKeyApprovalStatus, UserRoles } from '@prisma/client';
import v1Router from '~/controllers/v1/index';
import prisma from '~/prisma';
import { getDedicatedEntityLinkedToApiKey } from '~/utils/api';

const app = express();
app.use(express.json());
app.use('/v1', v1Router);

const FEI = 'ZACH-20261110-TEST-000001';
const ETG_1 = 'etg-1';
const ETG_2 = 'etg-2';

type FakeCarcasse = Record<string, any>;

const baseCarcasse: FakeCarcasse = {
  fei_numero: FEI,
  date_mise_a_mort: '2026-11-10T00:00:00.000Z',
  deleted_at: null,
  premier_detenteur_entity_id: 'pd-1',
  premier_detenteur_prochain_detenteur_id_cache: null,
  intermediaire_carcasse_refus_intermediaire_id: null,
  intermediaire_carcasse_manquante: null,
  svi_entity_id: null,
  svi_assigned_at: null,
  current_owner_entity_id: null,
  next_owner_entity_id: null,
  prev_owner_entity_id: null,
  CarcasseIntermediaire: [] as Array<{ intermediaire_entity_id: string }>,
};

const carcasseEtg1: FakeCarcasse = {
  ...baseCarcasse,
  zacharie_carcasse_id: `${FEI}_ETG1`,
  numero_bracelet: 'ETG1-OK',
  premier_detenteur_prochain_detenteur_id_cache: ETG_1,
  current_owner_entity_id: ETG_1,
  CarcasseIntermediaire: [{ intermediaire_entity_id: ETG_1 }],
};

const carcasseEtg1Refusee: FakeCarcasse = {
  ...baseCarcasse,
  zacharie_carcasse_id: `${FEI}_ETG1_REFUS`,
  numero_bracelet: 'ETG1-REFUS',
  premier_detenteur_prochain_detenteur_id_cache: ETG_1,
  intermediaire_carcasse_refus_intermediaire_id: 'collecteur-1',
  current_owner_entity_id: 'collecteur-1',
  CarcasseIntermediaire: [{ intermediaire_entity_id: 'collecteur-1' }],
};

const carcasseEtg2: FakeCarcasse = {
  ...baseCarcasse,
  zacharie_carcasse_id: `${FEI}_ETG2`,
  numero_bracelet: 'ETG2-SAISIE',
  premier_detenteur_prochain_detenteur_id_cache: ETG_2,
  current_owner_entity_id: ETG_2,
  intermediaire_carcasse_refus_intermediaire_id: 'refus-etg2',
  CarcasseIntermediaire: [{ intermediaire_entity_id: ETG_2 }],
};

const ALL_CARCASSES = [carcasseEtg1, carcasseEtg1Refusee, carcasseEtg2];

function matches(row: FakeCarcasse, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return [condition].flat().every((w: any) => matches(row, w));
    if (key === 'OR') return condition.some((w: any) => matches(row, w));
    if (key === 'NOT') return ![condition].flat().some((w: any) => matches(row, w));
    if (key === 'CarcasseIntermediaire') {
      return row.CarcasseIntermediaire.some((ci: any) => matches(ci, condition.some));
    }
    const value = row[key];
    if (condition === null || typeof condition !== 'object') return value === condition;
    return Object.entries(condition).every(([op, operand]: [string, any]) => {
      if (op === 'in') return operand.includes(value);
      if (op === 'not') return operand === null ? value !== null && value !== undefined : value !== operand;
      if (op === 'gte') return value >= operand;
      if (op === 'lte') return value <= operand;
      throw new Error(`Opérateur non géré par le test : ${op}`);
    });
  });
}

function fakeCarcasseFindMany(args: { where?: any; distinct?: Array<string> }) {
  const rows = ALL_CARCASSES.filter((row) => matches(row, args.where));
  if (!args.distinct) return Promise.resolve(rows);
  const seen = new Set<string>();
  return Promise.resolve(
    rows.filter((row) => {
      const key = args.distinct!.map((field) => String(row[field])).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
}

const fakeFei: Record<string, any> = {
  numero: FEI,
  date_mise_a_mort: new Date('2026-11-10'),
  FeiExaminateurInitialUser: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockImplementation(fakeCarcasseFindMany as any);
  vi.mocked(prisma.fei.findMany).mockResolvedValue([fakeFei] as any);
  vi.mocked(prisma.fei.findFirst).mockResolvedValue(fakeFei as any);
});

function bracelets(fei: { carcasses: Array<{ numero_bracelet: string }> }) {
  return fei.carcasses.map((c) => c.numero_bracelet).sort();
}

describe('GET /v1/fei — clé dédiée à une entité', () => {
  test("la clé de l'ETG 1 ne reçoit pas la carcasse partie chez l'ETG 2", async () => {
    vi.mocked(getDedicatedEntityLinkedToApiKey).mockResolvedValueOnce({ id: ETG_1 } as any);

    const res = await request(app)
      .get('/v1/fei?date_from=2026-11-01&date_to=2026-11-30')
      .set('Authorization', 'Bearer test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.feis).toHaveLength(1);
    expect(bracelets(res.body.data.feis[0])).toEqual(['ETG1-OK', 'ETG1-REFUS']);
  });

  test("la clé de l'ETG 2 ne reçoit que sa carcasse", async () => {
    vi.mocked(getDedicatedEntityLinkedToApiKey).mockResolvedValueOnce({ id: ETG_2 } as any);

    const res = await request(app)
      .get('/v1/fei?date_from=2026-11-01&date_to=2026-11-30')
      .set('Authorization', 'Bearer test-api-key');

    expect(res.status).toBe(200);
    expect(bracelets(res.body.data.feis[0])).toEqual(['ETG2-SAISIE']);
  });
});

describe('GET /v1/fei/user/:fei_numero — clé tierce au nom d’un utilisateur', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-etg-1',
      email: 'etg-1@example.fr',
      roles: [UserRoles.ETG],
    } as any);
    vi.mocked(prisma.apiKeyApprovalByUserOrEntity.findFirst).mockResolvedValue({
      status: ApiKeyApprovalStatus.APPROVED,
    } as any);
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: ETG_1 }] as any);
  });

  test("un utilisateur de l'ETG 1 ne reçoit pas la carcasse partie chez l'ETG 2", async () => {
    const res = await request(app)
      .get(`/v1/fei/user/${FEI}?email=etg-1@example.fr`)
      .set('Authorization', 'Bearer test-api-key');

    expect(res.status).toBe(200);
    expect(bracelets(res.body.data.fei)).toEqual(['ETG1-OK', 'ETG1-REFUS']);
  });

  test('aucune carcasse de la fiche dans le périmètre → 404', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'autre-etg' }] as any);

    const res = await request(app)
      .get(`/v1/fei/user/${FEI}?email=etg-1@example.fr`)
      .set('Authorization', 'Bearer test-api-key');

    expect(res.status).toBe(404);
  });
});
