import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseStatus, FeiOwnerRole } from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import { sendWebhook } from '~/utils/api';
import { formatRenvoiExpediteurEmail } from '~/utils/formatCarcasseEmail';
import {
  closeFeiAndNotifyChasseurOnSviCarcasseClose,
  notifyRenvoiExpediteur,
} from '~/utils/carcasse-side-effects';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/formatCarcasseEmail', () => ({
  formatManualValidationSviChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatCarcasseManquanteOrRefusChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatSaisieChasseurEmail: vi.fn().mockReturnValue(['object', 'body']),
  formatRenvoiExpediteurEmail: vi.fn().mockReturnValue(['object', 'body']),
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

// Renvoi : le destinataire (ETG/collecteur, ici next_owner = ETG) vide le next_owner ; le current_owner
// (l'expéditeur, ici le premier détenteur) reste inchangé.
const expediteurUser = { id: 'pd-1', email: 'pd@example.org', notifications: [] as string[] };

const makeRenvoiExisting = (overrides: any = {}) => ({
  zacharie_carcasse_id: `${feiNumero}_BR-A`,
  fei_numero: feiNumero,
  current_owner_user_id: 'pd-1',
  current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  next_owner_role: FeiOwnerRole.ETG,
  next_owner_entity_id: 'etg-entity-1',
  next_owner_entity_name_cache: 'ETG du Loup',
  next_owner_user_id: null,
  next_owner_user_name_cache: null,
  premier_detenteur_prochain_detenteur_id_cache: 'etg-entity-1',
  ...overrides,
});

const makeRenvoiUpdated = (overrides: any = {}) =>
  makeRenvoiExisting({
    next_owner_role: null,
    next_owner_entity_id: null,
    next_owner_entity_name_cache: null,
    next_owner_user_id: null,
    next_owner_user_name_cache: null,
    ...overrides,
  });

describe('notifyRenvoiExpediteur', () => {
  test('notifies the expéditeur (current-owner) when a recipient returns the fiche', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(expediteurUser as any);
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(makeFei() as any);

    await notifyRenvoiExpediteur(makeRenvoiExisting() as any, makeRenvoiUpdated() as any);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'pd-1' } });
    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    const arg = vi.mocked(sendNotificationToUser).mock.calls[0][0] as any;
    expect(arg.user).toBe(expediteurUser);
    expect(arg.notificationLogAction).toBe(`FEI_RENVOYEE_${feiNumero}_etg-entity-1`);
    // le formateur reçoit le rôle de l'expéditeur + le nom du destinataire qui renvoie
    expect(formatRenvoiExpediteurEmail).toHaveBeenCalledWith(
      expect.objectContaining({ numero: feiNumero }),
      FeiOwnerRole.PREMIER_DETENTEUR,
      'ETG du Loup',
      'etg-entity-1'
    );
  });

  test('no-op on a prise en charge (current-owner changes to the recipient)', async () => {
    const existing = makeRenvoiExisting();
    const updated = makeRenvoiUpdated({
      current_owner_user_id: 'etg-user-1',
      current_owner_role: FeiOwnerRole.ETG,
    });

    await notifyRenvoiExpediteur(existing as any, updated as any);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('no-op when the next_owner is still set (no renvoi happened)', async () => {
    const existing = makeRenvoiExisting();
    const updated = makeRenvoiExisting();

    await notifyRenvoiExpediteur(existing as any, updated as any);

    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('uses one stable action key across the whole returned batch (dedups to a single notif)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(expediteurUser as any);
    vi.mocked(prisma.fei.findUnique).mockResolvedValue(makeFei() as any);

    await notifyRenvoiExpediteur(
      makeRenvoiExisting({ zacharie_carcasse_id: `${feiNumero}_BR-A` }) as any,
      makeRenvoiUpdated({ zacharie_carcasse_id: `${feiNumero}_BR-A` }) as any
    );
    await notifyRenvoiExpediteur(
      makeRenvoiExisting({ zacharie_carcasse_id: `${feiNumero}_BR-B` }) as any,
      makeRenvoiUpdated({ zacharie_carcasse_id: `${feiNumero}_BR-B` }) as any
    );

    const actions = vi
      .mocked(sendNotificationToUser)
      .mock.calls.map((c) => (c[0] as any).notificationLogAction);
    // clé identique pour les 2 carcasses → la dédup notificationLog n'enverra qu'une notif
    expect(actions).toEqual([
      `FEI_RENVOYEE_${feiNumero}_etg-entity-1`,
      `FEI_RENVOYEE_${feiNumero}_etg-entity-1`,
    ]);
  });

  test('no-op when the expéditeur user cannot be found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as any);

    await notifyRenvoiExpediteur(makeRenvoiExisting() as any, makeRenvoiUpdated() as any);

    expect(prisma.fei.findUnique).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
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
