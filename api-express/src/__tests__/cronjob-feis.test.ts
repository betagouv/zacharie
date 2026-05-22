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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
});

describe('automaticClosingOfFeis — pending modif requests', () => {
  test('excludes FEIs whose carcasses have a pending non-deleted modif request', async () => {
    await automaticClosingOfFeis();

    expect(prisma.fei.findMany).toHaveBeenCalledOnce();
    const args = vi.mocked(prisma.fei.findMany).mock.calls[0][0] as any;
    expect(args.where.Carcasses).toEqual({
      none: {
        CarcasseModificationRequests: {
          some: {
            status: CarcasseModificationRequestStatus.PENDING,
            deleted_at: null,
          },
        },
      },
    });
  });

  test('still filters on svi_assigned_at, svi_closed_at, automatic_closed_at', async () => {
    await automaticClosingOfFeis();
    const args = vi.mocked(prisma.fei.findMany).mock.calls[0][0] as any;
    expect(args.where.svi_closed_at).toBeNull();
    expect(args.where.automatic_closed_at).toBeNull();
    expect(args.where.svi_assigned_at).toHaveProperty('lte');
    expect(args.where.svi_assigned_at.lte).toBeInstanceOf(Date);
  });

  test('does nothing when no FEI matches (no carcasse status updates, no notifications)', async () => {
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([]);
    await automaticClosingOfFeis();

    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });
});

// PR #399 — automaticClosingOfFeis now writes per-carcasse closure fields, not just FEI-level.
// `updateCarcasseStatus` returns ACCEPTE for any carcasse whose svi_assigned_to_fei_at is >= 10
// days old AND has no IPM decision (cron-eligible state). The cron only calls `prisma.carcasse.update`
// when newStatus !== current status — these tests exercise both branches.
describe('automaticClosingOfFeis — per-carcasse closure fields (PR #399)', () => {
  const sviEntityId = 'svi-entity-1';
  const sviAssignedAt = dayjs().subtract(11, 'days').toDate();

  const makeFei = (overrides: any = {}) => ({
    id: 'fei-1',
    numero: 'ZACH-TEST-001',
    svi_assigned_at: sviAssignedAt,
    svi_entity_id: sviEntityId,
    svi_user_id: null,
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

  const makeCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: 'ZACH-TEST-001_BR-A',
    fei_numero: 'ZACH-TEST-001',
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    // Cron-eligible: 10+ days under SVI with no IPM decision → newStatus becomes ACCEPTE.
    svi_assigned_to_fei_at: sviAssignedAt,
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

  test('updates every eligible carcasse with svi_automatic_closed_at, SVI ownership, wiped next_owner_*', async () => {
    const carcasses = [makeCarcasse({ zacharie_carcasse_id: 'ZACH-TEST-001_BR-A' }), makeCarcasse({ zacharie_carcasse_id: 'ZACH-TEST-001_BR-B' })];
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([makeFei({ Carcasses: carcasses })] as any);
    // updateCarcasseStatus reads carcasse.svi_carcasse_status AFTER the first prisma.carcasse.update;
    // it doesn't matter for the assertions — we just need the function to return an updated carcasse.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasses[0], ...data }));

    await automaticClosingOfFeis();

    expect(prisma.carcasse.update).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.carcasse.update).mock.calls) {
      const data = (call[0] as any).data;
      expect(data.svi_automatic_closed_at).toBeInstanceOf(Date);
      expect(data.current_owner_role).toBe(FeiOwnerRole.SVI);
      expect(data.current_owner_entity_id).toBe(sviEntityId);
      expect(data.current_owner_user_id).toBeNull();
      // PR-noted FIXME — names not derivable yet, set to null intentionally.
      expect(data.current_owner_user_name_cache).toBeNull();
      expect(data.current_owner_entity_name_cache).toBeNull();
      // next_owner_* fully wiped
      expect(data.next_owner_role).toBeNull();
      expect(data.next_owner_user_id).toBeNull();
      expect(data.next_owner_entity_id).toBeNull();
      expect(data.next_owner_entity_name_cache).toBeNull();
      // svi_carcasse_status flipped to ACCEPTE (10+ days, no IPM decision)
      expect(data.svi_carcasse_status).toBe(CarcasseStatus.ACCEPTE);
    }
  });

  test('rotates prev_owner_* from the old current_owner_* when carcasse was NOT yet at SVI', async () => {
    const carcasse = makeCarcasse({
      current_owner_role: FeiOwnerRole.ETG,
      current_owner_entity_id: 'etg-entity-1',
      current_owner_user_id: 'etg-user-1',
    });
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([makeFei({ Carcasses: [carcasse] })] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([makeFei({ Carcasses: [carcasse] })] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.carcasse.update as any).mockImplementation(async ({ data }: any) => ({ ...carcasse, ...data }));

    await automaticClosingOfFeis();

    const data = (vi.mocked(prisma.carcasse.update).mock.calls[0][0] as any).data;
    // Same-role transitions keep the original prev_owner_* untouched.
    expect(data.prev_owner_role).toBe(FeiOwnerRole.ETG);
    expect(data.prev_owner_entity_id).toBe('etg-entity-1');
    expect(data.prev_owner_user_id).toBe('etg-user-1');
  });

  test('skips carcasse.update when status would not change (e.g. already ACCEPTE)', async () => {
    // ACCEPTE + 10+ days → updateCarcasseStatus returns ACCEPTE, equal to current status.
    // The `if (newStatus !== carcasse.svi_carcasse_status)` branch in feis.ts short-circuits.
    const carcasse = makeCarcasse({
      svi_carcasse_status: CarcasseStatus.ACCEPTE,
    });
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([makeFei({ Carcasses: [carcasse] })] as any);

    await automaticClosingOfFeis();

    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test('still updates the FEI-level closure fields (FIXME path until full carcasse migration)', async () => {
    vi.mocked(prisma.fei.findMany).mockResolvedValueOnce([makeFei({ Carcasses: [makeCarcasse()] })] as any);

    await automaticClosingOfFeis();

    expect(prisma.fei.update).toHaveBeenCalledOnce();
    const data = (vi.mocked(prisma.fei.update).mock.calls[0][0] as any).data;
    expect(data.automatic_closed_at).toBeInstanceOf(Date);
    expect(data.fei_current_owner_role).toBe(FeiOwnerRole.SVI);
    expect(data.fei_current_owner_entity_id).toBe(sviEntityId);
  });
});
