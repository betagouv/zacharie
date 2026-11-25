import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { EntityRelationType, Prisma, UserRoles } from '@prisma/client';
import type { Carcasse, CarcasseIntermediaire } from '@prisma/client';
import { getCcgIntermediaires, redactCarcasseForCcg } from '~/utils/ccg-read-only';

// Le propriétaire d'un CCG (relation CAN_TRANSMIT_CARCASSES_TO_ENTITY au statut ADMIN), quel que soit son
// rôle, reçoit dans GET /carcasse les fiches déposées dans son CCG, à part et sans leur statut.

const etgUser = { id: 'user-etg', roles: [UserRoles.ETG], activated: true, isZacharieAdmin: false };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 8, minutes));

const ccgCarcasse = {
  zacharie_carcasse_id: 'FEI-1_B1',
  fei_numero: 'FEI-1',
  numero_bracelet: 'B1',
  espece: 'Chevreuil',
  updated_at: at(10),
  examinateur_anomalies_carcasse: ['Abcès'],
  premier_detenteur_depot_entity_id: 'ccg-1',
  premier_detenteur_depot_ccg_at: at(1),
  svi_carcasse_status: 'SAISIE_TOTALE',
  svi_ipm2_lesions_ou_motifs: ['Tuberculose'],
  intermediaire_carcasse_refus_motif: 'Souillure',
  current_owner_entity_id: 'etg-autre',
  notifier_consommateur: true,
} as unknown as Carcasse;

const intermediaire = (id: string, minutes: number, extra: Partial<CarcasseIntermediaire> = {}) =>
  ({
    fei_numero: 'FEI-1',
    numero_bracelet: 'B1',
    zacharie_carcasse_id: 'FEI-1_B1',
    intermediaire_id: id,
    intermediaire_entity_id: `entity-${id}`,
    intermediaire_user_id: `user-${id}`,
    created_at: at(minutes),
    prise_en_charge_at: at(minutes),
    refus: null,
    commentaire: 'commentaire',
    deleted_at: null,
    ...extra,
  }) as unknown as CarcasseIntermediaire;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockImplementation((async (args: any) =>
    args?.where?.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
      ? [{ entity_id: 'ccg-1' }]
      : [{ entity_id: 'etg-1' }]) as any);
});

describe('redactCarcasseForCcg', () => {
  test('garde la chasse et le dépôt, vide le devenir de la carcasse', () => {
    const redacted = redactCarcasseForCcg(ccgCarcasse);
    expect(redacted.espece).toBe('Chevreuil');
    expect(redacted.examinateur_anomalies_carcasse).toEqual(['Abcès']);
    expect(redacted.premier_detenteur_depot_entity_id).toBe('ccg-1');
    expect(redacted.svi_carcasse_status).toBeNull();
    expect(redacted.svi_ipm2_lesions_ou_motifs).toEqual([]);
    expect(redacted.intermediaire_carcasse_refus_motif).toBeNull();
    expect(redacted.current_owner_entity_id).toBeNull();
    expect(redacted.notifier_consommateur).toBe(false);
  });
});

describe('getCcgIntermediaires', () => {
  test('dépôt par le premier détenteur : seul celui qui sort la carcasse du CCG, sans décision', () => {
    const rows = getCcgIntermediaires(
      ccgCarcasse,
      [
        intermediaire('etg', 30, { refus: 'Souillure', intermediaire_depot_entity_id: 'autre' }),
        intermediaire('collecteur', 20, { intermediaire_depot_entity_id: 'autre' }),
      ],
      ['ccg-1']
    );
    expect(rows.map((row) => row.intermediaire_id)).toEqual(['collecteur']);
    expect(rows[0].prise_en_charge_at).toEqual(at(20));
    expect(rows[0].commentaire).toBeNull();
    expect(rows[0].intermediaire_depot_entity_id).toBeNull();
  });

  test('dépôt par un intermédiaire : jusqu’à celui qui sort la carcasse du CCG', () => {
    const rows = getCcgIntermediaires(
      { premier_detenteur_depot_entity_id: null },
      [
        intermediaire('collecteur', 20, { intermediaire_depot_entity_id: 'ccg-1' }),
        intermediaire('etg', 30),
        intermediaire('svi-suite', 40),
      ],
      ['ccg-1']
    );
    expect(rows.map((row) => row.intermediaire_id)).toEqual(['collecteur', 'etg']);
    expect(rows[0].intermediaire_depot_entity_id).toBe('ccg-1');
  });
});

describe('GET /carcasse — propriétaire de CCG', () => {
  test('les branches CCG entrent dans la page, en lecture seule', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ zacharie_carcasse_id: 'FEI-1_B1' }] as any);
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([ccgCarcasse]) // relecture de la page
      .mockResolvedValueOnce([]); // aucune carcasse dans le périmètre du rôle
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValueOnce([intermediaire('collecteur', 20)]);

    const res = await request(app)
      .get('/carcasse?after=0&limit=100&withDeleted=true')
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);
    const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as [
      TemplateStringsArray,
      ...any[],
    ];
    const query = Prisma.sql(strings, ...values);
    expect(query.sql).toContain('c.premier_detenteur_depot_entity_id IN');
    expect(query.sql).toContain('ci.intermediaire_depot_entity_id IN');

    expect(res.body.data.carcasses).toEqual([]);
    expect(res.body.data.carcassesIntermediaires).toEqual([]);
    expect(res.body.data.ccgEntityIds).toEqual(['ccg-1']);
    expect(res.body.data.ccgCarcasses).toHaveLength(1);
    expect(res.body.data.ccgCarcasses[0].svi_carcasse_status).toBeNull();
    expect(res.body.data.ccgCarcassesIntermediaires).toHaveLength(1);
    expect(res.body.data.nextCursor).toEqual({
      updatedAt: String(at(10).getTime()),
      id: 'FEI-1_B1',
    });
  });

  test('une carcasse aussi dans le périmètre du rôle reste complète', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ zacharie_carcasse_id: 'FEI-1_B1' }] as any);
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([ccgCarcasse])
      .mockResolvedValueOnce([{ zacharie_carcasse_id: 'FEI-1_B1' }] as any);

    const res = await request(app)
      .get('/carcasse?after=0&limit=100&withDeleted=true')
      .set('x-test-user', JSON.stringify(etgUser));

    expect(res.body.data.ccgCarcasses).toEqual([]);
    expect(res.body.data.carcasses).toHaveLength(1);
    expect(res.body.data.carcasses[0].svi_carcasse_status).toBe('SAISIE_TOTALE');
  });
});
