import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseModificationRequestStatus } from '@prisma/client';
import prisma from '~/prisma';
import { automaticClosingOfFeis } from '~/cronjobs/feis';

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
