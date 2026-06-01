import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseStatus } from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import { sendWebhook } from '~/utils/api';
import { closeFeiAndNotifyChasseurOnSviCarcasseClose } from '~/utils/carcasse-side-effects';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/formatCarcasseEmail', () => ({
  formatManualValidationSviChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatCarcasseManquanteOrRefusChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatSaisieChasseurEmail: vi.fn().mockReturnValue(['object', 'body']),
}));
vi.mock('~/utils/generate-certificats', () => ({ checkGenerateCertificat: vi.fn() }));
vi.mock('~/utils/api', () => ({ sendWebhook: vi.fn().mockResolvedValue(undefined) }));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

const feiNumero = 'ZACH-TEST-001';
const sviUserId = 'svi-user-1';

// Carcasse close au SVI (svi_closed_at posé) → isCarcasseDone court-circuite à true.
const makeClosedCarcasse = (overrides: any = {}) => ({
  zacharie_carcasse_id: `${feiNumero}_BR-A`,
  fei_numero: feiNumero,
  svi_closed_at: new Date('2026-05-20T10:00:00Z'),
  svi_closed_by_user_id: sviUserId,
  svi_automatic_closed_at: null,
  svi_carcasse_status: CarcasseStatus.ACCEPTE,
  consommateur_final_usage_domestique: null,
  intermediaire_carcasse_manquante: false,
  intermediaire_carcasse_refus_intermediaire_id: null,
  ...overrides,
});

// Carcasse non terminale (CONSIGNE en attente IPM2, pas de clôture) → isCarcasseDone false.
const makeOpenCarcasse = (overrides: any = {}) =>
  makeClosedCarcasse({
    zacharie_carcasse_id: `${feiNumero}_BR-OPEN`,
    svi_closed_at: null,
    svi_closed_by_user_id: null,
    svi_carcasse_status: CarcasseStatus.CONSIGNE,
    ...overrides,
  });

const examinateur = { id: 'exam-1' };
const premierDetenteur = { id: 'pd-1' };

const makeFei = (overrides: any = {}) => ({
  id: 'fei-1',
  numero: feiNumero,
  svi_closed_at: null,
  svi_user_id: sviUserId,
  FeiExaminateurInitialUser: examinateur,
  FeiPremierDetenteurUser: premierDetenteur,
  Carcasses: [makeClosedCarcasse()],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue(null as any);
  vi.mocked(prisma.fei.update).mockResolvedValue({} as any);
});

describe('closeFeiAndNotifyChasseurOnSviCarcasseClose — early returns', () => {
  test('no-op when the carcasse was already closed (no svi_closed_at transition)', async () => {
    const carcasse = makeClosedCarcasse();
    await closeFeiAndNotifyChasseurOnSviCarcasseClose(carcasse as any, carcasse as any);

    expect(prisma.fei.findUnique).not.toHaveBeenCalled();
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('no-op when the update does not set svi_closed_at', async () => {
    const existing = makeOpenCarcasse();
    const updated = makeOpenCarcasse();
    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(prisma.fei.findUnique).not.toHaveBeenCalled();
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test('does NOT close the FEI when one carcasse is still not terminal', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse();
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({ Carcasses: [makeClosedCarcasse(), makeOpenCarcasse()] }) as any
    );

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });
});

describe('closeFeiAndNotifyChasseurOnSviCarcasseClose — full close', () => {
  test('writes Fei.svi_closed_at (latest carcasse date) + svi_closed_by_user_id, notifies both', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse({ svi_closed_at: new Date('2026-05-20T10:00:00Z') });
    const early = makeClosedCarcasse({
      zacharie_carcasse_id: `${feiNumero}_BR-EARLY`,
      svi_closed_at: new Date('2026-05-18T08:00:00Z'),
    });
    const late = makeClosedCarcasse({
      zacharie_carcasse_id: `${feiNumero}_BR-LATE`,
      svi_closed_at: new Date('2026-05-21T16:00:00Z'),
    });
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({ svi_closed_at: null, Carcasses: [early, late] }) as any
    );

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(prisma.fei.update).toHaveBeenCalledOnce();
    const arg = vi.mocked(prisma.fei.update).mock.calls[0][0] as any;
    expect(arg.where).toEqual({ id: 'fei-1' });
    // clôture la plus tardive parmi les carcasses de la fiche
    expect(arg.data.svi_closed_at).toEqual(new Date('2026-05-21T16:00:00Z'));
    expect(arg.data.svi_closed_by_user_id).toBe(sviUserId);

    expect(sendNotificationToUser).toHaveBeenCalledTimes(2);
    expect(sendWebhook).toHaveBeenCalledWith('exam-1', 'FEI_CLOTUREE', { feiNumero });
    expect(sendWebhook).toHaveBeenCalledWith('pd-1', 'FEI_CLOTUREE', { feiNumero });
  });

  test('does not notify the premier détenteur twice when they are the examinateur', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse();
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({ FeiPremierDetenteurUser: examinateur }) as any
    );

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    expect(sendWebhook).toHaveBeenCalledOnce();
  });
});

describe('closeFeiAndNotifyChasseurOnSviCarcasseClose — idempotency', () => {
  test('skips the FEI write when svi_closed_at is already set, and dedups the notification', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse();
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(
      makeFei({ svi_closed_at: new Date('2026-05-19T09:00:00Z') }) as any
    );
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValueOnce({ id: 'log-1' } as any);

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
    expect(sendWebhook).not.toHaveBeenCalled();
  });
});
