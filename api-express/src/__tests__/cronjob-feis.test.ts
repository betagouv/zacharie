import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseModificationRequestStatus, CarcasseStatus, FeiOwnerRole } from '@prisma/client';
import prisma from '~/prisma';
import { automaticClosingOfFeis } from '~/cronjobs/feis';
import dayjs from 'dayjs';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/formatCarcasseEmail', () => ({
  formatAutomaticClosingEmailForChasseur: vi.fn().mockResolvedValue(['object', 'body']),
  formatCarcasseChasseurEmail: vi.fn(),
}));
vi.mock('~/utils/api', () => ({
  sendWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

const sviEntityId = 'svi-entity-1';
const sviAssignedAt = dayjs().subtract(11, 'days').toDate();

// Carcasse cron-eligible : 10+ jours sous SVI, sans décision IPM → updateCarcasseStatus renvoie ACCEPTE.
const makeCarcasse = (overrides: any = {}) => ({
  zacharie_carcasse_id: 'ZACH-TEST-001_BR-A',
  fei_numero: 'ZACH-TEST-001',
  svi_carcasse_status: CarcasseStatus.SANS_DECISION,
  svi_assigned_to_fei_at: sviAssignedAt,
  svi_closed_at: null,
  svi_automatic_closed_at: null,
  consommateur_final_usage_domestique: null,
  svi_ipm1_date: null,
  svi_ipm2_date: null,
  svi_ipm1_decision: null,
  svi_ipm2_decision: null,
  svi_ipm1_presentee_inspection: null,
  svi_ipm2_presentee_inspection: null,
  svi_ipm2_traitement_assainissant: [],
  intermediaire_carcasse_manquante: false,
  intermediaire_carcasse_refus_intermediaire_id: null,
  svi_entity_id: sviEntityId,
  svi_user_id: null,
  current_owner_role: FeiOwnerRole.ETG,
  current_owner_entity_id: 'etg-entity-1',
  current_owner_user_id: null,
  prev_owner_entity_id: null,
  prev_owner_role: null,
  prev_owner_user_id: null,
  ...overrides,
});

const makeFei = (overrides: any = {}) => ({
  id: 'fei-1',
  numero: 'ZACH-TEST-001',
  svi_assigned_at: sviAssignedAt,
  svi_entity_id: sviEntityId,
  svi_user_id: null,
  svi_closed_at: null,
  automatic_closed_at: null,
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: 'ETG 1 User',
  fei_current_owner_entity_id: 'etg-entity-1',
  fei_current_owner_entity_name_cache: 'ETG 1',
  fei_current_owner_role: FeiOwnerRole.ETG,
  fei_next_owner_user_name_cache: null,
  fei_next_owner_entity_name_cache: 'SVI 1',
  FeiExaminateurInitialUser: null,
  FeiPremierDetenteurUser: null,
  Carcasses: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findUnique).mockResolvedValue(null as any);
});

describe('automaticClosingOfFeis — carcasse selection (per-carcasse)', () => {
  test('selects carcasses 10+ days under SVI, not yet closed, without pending modif request', async () => {
    await automaticClosingOfFeis();

    expect(prisma.carcasse.findMany).toHaveBeenCalledOnce();
    const args = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0] as any;
    expect(args.where.svi_closed_at).toBeNull();
    expect(args.where.svi_automatic_closed_at).toBeNull();
    expect(args.where.deleted_at).toBeNull();
    expect(args.where.svi_assigned_to_fei_at).toHaveProperty('lte');
    expect(args.where.svi_assigned_to_fei_at.lte).toBeInstanceOf(Date);
    expect(args.where.CarcasseModificationRequests).toEqual({
      none: {
        status: CarcasseModificationRequestStatus.PENDING,
        deleted_at: null,
      },
    });
  });

  test('does nothing when no carcasse matches', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([]);
    await automaticClosingOfFeis();

    expect(prisma.carcasse.update).not.toHaveBeenCalled();
    expect(prisma.fei.findUnique).not.toHaveBeenCalled();
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });
});

describe('automaticClosingOfFeis — per-carcasse closure fields', () => {
  test('updates every eligible carcasse with svi_automatic_closed_at, SVI ownership, wiped next_owner_*', async () => {
    const carcasses = [
      makeCarcasse({ zacharie_carcasse_id: 'ZACH-TEST-001_BR-A' }),
      makeCarcasse({ zacharie_carcasse_id: 'ZACH-TEST-001_BR-B' }),
    ];
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce(carcasses as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({
      ...carcasses[0],
      ...data,
    }));
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null as any);

    await automaticClosingOfFeis();

    expect(prisma.carcasse.update).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.carcasse.update).mock.calls) {
      const data = (call[0] as any).data;
      expect(data.svi_automatic_closed_at).toBeInstanceOf(Date);
      expect(data.current_owner_role).toBe(FeiOwnerRole.SVI);
      expect(data.current_owner_entity_id).toBe(sviEntityId);
      expect(data.current_owner_user_id).toBeNull();
      // FIXME — noms non dérivables pour l'instant, null intentionnel.
      expect(data.current_owner_user_name_cache).toBeNull();
      expect(data.current_owner_entity_name_cache).toBeNull();
      expect(data.next_owner_role).toBeNull();
      expect(data.next_owner_user_id).toBeNull();
      expect(data.next_owner_entity_id).toBeNull();
      expect(data.next_owner_entity_name_cache).toBeNull();
      // 10+ jours, pas de décision IPM → ACCEPTE
      expect(data.svi_carcasse_status).toBe(CarcasseStatus.ACCEPTE);
    }
  });

  test('always updates the carcasse, even when status would not change (e.g. already ACCEPTE)', async () => {
    const carcasse = makeCarcasse({ svi_carcasse_status: CarcasseStatus.ACCEPTE });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([carcasse] as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));

    await automaticClosingOfFeis();

    expect(prisma.carcasse.update).toHaveBeenCalledOnce();
    const data = (vi.mocked(prisma.carcasse.update).mock.calls[0][0] as any).data;
    expect(data.svi_automatic_closed_at).toBeInstanceOf(Date);
  });

  test('rotates prev_owner_* from old current_owner_* when carcasse was NOT yet at SVI', async () => {
    const carcasse = makeCarcasse({
      current_owner_role: FeiOwnerRole.ETG,
      current_owner_entity_id: 'etg-entity-1',
      current_owner_user_id: 'etg-user-1',
    });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([carcasse] as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));

    await automaticClosingOfFeis();

    const data = (vi.mocked(prisma.carcasse.update).mock.calls[0][0] as any).data;
    expect(data.prev_owner_role).toBe(FeiOwnerRole.ETG);
    expect(data.prev_owner_entity_id).toBe('etg-entity-1');
    expect(data.prev_owner_user_id).toBe('etg-user-1');
  });

  test('preserves prev_owner_* when carcasse was ALREADY at SVI (no SVI→SVI overwrite)', async () => {
    const carcasse = makeCarcasse({
      current_owner_role: FeiOwnerRole.SVI,
      current_owner_entity_id: sviEntityId,
      current_owner_user_id: null,
      prev_owner_role: FeiOwnerRole.ETG,
      prev_owner_entity_id: 'etg-entity-1',
      prev_owner_user_id: 'etg-user-1',
    });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([carcasse] as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));

    await automaticClosingOfFeis();

    const data = (vi.mocked(prisma.carcasse.update).mock.calls[0][0] as any).data;
    expect(data.prev_owner_role).toBe(FeiOwnerRole.ETG);
    expect(data.prev_owner_entity_id).toBe('etg-entity-1');
    expect(data.prev_owner_user_id).toBe('etg-user-1');
  });
});

describe('automaticClosingOfFeis — FEI closed only when all carcasses are terminal', () => {
  test('closes the FEI when every carcasse is done', async () => {
    const carcasse = makeCarcasse();
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([carcasse] as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));
    // Après mise à jour, toutes les carcasses de la FEI sont closes.
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({ Carcasses: [{ ...carcasse, svi_automatic_closed_at: new Date() }] }) as any
    );

    await automaticClosingOfFeis();

    expect(prisma.fei.update).toHaveBeenCalledOnce();
    const data = (vi.mocked(prisma.fei.update).mock.calls[0][0] as any).data;
    expect(data.automatic_closed_at).toBeInstanceOf(Date);
    expect(data.fei_current_owner_role).toBe(FeiOwnerRole.SVI);
    expect(data.fei_current_owner_entity_id).toBe(sviEntityId);
  });

  test('does NOT close the FEI when one carcasse is still not terminal (e.g. CONSIGNE)', async () => {
    const carcasse = makeCarcasse();
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([carcasse] as any);
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({
        Carcasses: [
          { ...carcasse, svi_automatic_closed_at: new Date() },
          makeCarcasse({
            zacharie_carcasse_id: 'ZACH-TEST-001_BR-B',
            svi_carcasse_status: CarcasseStatus.CONSIGNE,
          }),
        ],
      }) as any
    );

    await automaticClosingOfFeis();

    expect(prisma.fei.update).not.toHaveBeenCalled();
  });
});
