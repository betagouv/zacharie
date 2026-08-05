import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseStatus, FeiOwnerRole, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import { VITE_APP_URL } from '~/config';
import sendNotificationToUser from '~/service/notifications';
import { sendWebhook } from '~/utils/api';
import { formatRenvoiExpediteurEmail } from '~/utils/formatCarcasseEmail';
import { sendTemplateEmail } from '~/third-parties/brevo';
import { BrevoTemplateId } from '~/third-parties/brevo-templates';
import {
  closeFeiAndNotifyChasseurOnSviCarcasseClose,
  notifyRenvoiExpediteur,
  notifyCircuitCourt,
  notifyNextOwnerEntity,
  notifyNextOwnerUser,
  notifySviAssignment,
  webhookIntermediaireClose,
} from '~/utils/carcasse-side-effects';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/templates/get-fiche-pdf', () => ({
  getFichePdf: vi.fn().mockResolvedValue('base64pdf'),
}));
vi.mock('~/third-parties/brevo', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendTemplateEmail: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  updateBrevoETGDealPremiereFiche: vi.fn().mockResolvedValue(undefined),
  updateBrevoSVIDealPremiereFiche: vi.fn().mockResolvedValue(undefined),
}));
// Mock partiel : les `format*TemplateEmail` gardent leur vraie implémentation, ce sont les params
// envoyés à Brevo qu'on veut vérifier.
vi.mock('~/utils/formatCarcasseEmail', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  formatManualValidationSviChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatCarcasseManquanteOrRefusChasseurEmail: vi.fn().mockResolvedValue(['object', 'body']),
  formatSaisieChasseurEmail: vi.fn().mockReturnValue(['object', 'body']),
  formatRenvoiExpediteurEmail: vi.fn().mockReturnValue(['object', 'body']),
  formatSviAssignedEmail: vi.fn().mockResolvedValue({
    object: 'object',
    text: 'body',
    params: { entity_name: 'ETG 1', count: 3 },
  }),
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

  test('does not notify when one carcasse of the transmission is still not terminal', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse();
    // La clôture/notif n'est déclenchée que si TOUTES les carcasses du lot sont terminales.
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      makeClosedCarcasse(),
      makeOpenCarcasse(),
    ] as any);

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    expect(sendNotificationToUser).not.toHaveBeenCalled();
    expect(sendWebhook).not.toHaveBeenCalled();
  });
});

describe('closeFeiAndNotifyChasseurOnSviCarcasseClose — full close', () => {
  test('notifies examinateur + premier détenteur with a CARCASSE_CLOTUREE webhook', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse({
      examinateur_initial_user_id: examinateur.id,
      premier_detenteur_user_id: premierDetenteur.id,
      premier_detenteur_prochain_detenteur_id_cache: 'etg-entity-1',
    });
    // Toutes les carcasses du lot sont terminales → clôture par carcasse + notif.
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      makeClosedCarcasse(),
      makeClosedCarcasse({ zacharie_carcasse_id: `${feiNumero}_BR-B` }),
    ] as any);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(examinateur as any)
      .mockResolvedValueOnce(premierDetenteur as any);

    await closeFeiAndNotifyChasseurOnSviCarcasseClose(existing as any, updated as any);

    // La clôture vit désormais par carcasse : plus de Fei.update ici.
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).toHaveBeenCalledTimes(2);
    expect(sendWebhook).toHaveBeenCalledWith(examinateur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updated.zacharie_carcasse_id,
    });
    expect(sendWebhook).toHaveBeenCalledWith(premierDetenteur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updated.zacharie_carcasse_id,
    });
  });

  test('does not notify the premier détenteur twice when they are the examinateur', async () => {
    const existing = makeClosedCarcasse({ svi_closed_at: null, svi_closed_by_user_id: null });
    const updated = makeClosedCarcasse({
      examinateur_initial_user_id: examinateur.id,
      premier_detenteur_user_id: examinateur.id,
    });
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([makeClosedCarcasse()] as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(examinateur as any);

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

// Clôture par intermédiaire (circuit court agréé) : quand intermediaire_closed_at passe de null à une
// date, on prévient examinateur + premier détenteur par webhook CARCASSE_CLOTUREE.
describe('webhookIntermediaireClose', () => {
  const makeIntermediaireCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: `${feiNumero}_BR-A`,
    fei_numero: feiNumero,
    examinateur_initial_user_id: 'exam-1',
    premier_detenteur_user_id: 'pd-1',
    intermediaire_closed_at: null,
    ...overrides,
  });

  test('no-op when the carcasse was already closed by an intermediaire', async () => {
    const existing = makeIntermediaireCarcasse({ intermediaire_closed_at: new Date() });
    const updated = makeIntermediaireCarcasse({ intermediaire_closed_at: new Date() });
    await webhookIntermediaireClose(existing as any, updated as any);
    expect(sendWebhook).not.toHaveBeenCalled();
  });

  test('no-op when the update does not set intermediaire_closed_at', async () => {
    const c = makeIntermediaireCarcasse();
    await webhookIntermediaireClose(c as any, c as any);
    expect(sendWebhook).not.toHaveBeenCalled();
  });

  test('on transition → CARCASSE_CLOTUREE webhook to examinateur + premier détenteur', async () => {
    const existing = makeIntermediaireCarcasse();
    const updated = makeIntermediaireCarcasse({ intermediaire_closed_at: new Date() });
    vi.mocked(prisma.user.findUnique).mockImplementation((({ where }: any) =>
      Promise.resolve(
        where.id === 'exam-1' ? { id: 'exam-1' } : where.id === 'pd-1' ? { id: 'pd-1' } : null
      )) as any);

    await webhookIntermediaireClose(existing as any, updated as any);

    expect(sendWebhook).toHaveBeenCalledWith('exam-1', 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: `${feiNumero}_BR-A`,
    });
    expect(sendWebhook).toHaveBeenCalledWith('pd-1', 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: `${feiNumero}_BR-A`,
    });
    expect(sendWebhook).toHaveBeenCalledTimes(2);
  });

  test('does not double-webhook when premier détenteur is the examinateur', async () => {
    const existing = makeIntermediaireCarcasse({ premier_detenteur_user_id: 'exam-1' });
    const updated = makeIntermediaireCarcasse({
      premier_detenteur_user_id: 'exam-1',
      intermediaire_closed_at: new Date(),
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'exam-1' } as any);

    await webhookIntermediaireClose(existing as any, updated as any);

    expect(sendWebhook).toHaveBeenCalledOnce();
    expect(sendWebhook).toHaveBeenCalledWith('exam-1', 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: `${feiNumero}_BR-A`,
    });
  });
});

describe('notifyCircuitCourt', () => {
  const actingUser = { id: 'pd-1', prenom: 'Pierre', nom_de_famille: 'Petit' } as any;

  const makeCircuitCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: `${feiNumero}_BR-A`,
    fei_numero: feiNumero,
    examinateur_initial_user_id: 'exam-1',
    premier_detenteur_user_id: 'pd-1',
    premier_detenteur_prochain_detenteur_id_cache: 'commerce-1',
    next_owner_entity_id: 'commerce-1',
    next_owner_role: FeiOwnerRole.COMMERCE_DE_DETAIL,
    current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
    ...overrides,
  });

  const mockUsersByIds = () =>
    vi
      .mocked(prisma.user.findUnique)
      .mockImplementation((({ where }: any) =>
        Promise.resolve(
          where.id === 'exam-1' ? { id: 'exam-1' } : where.id === 'pd-1' ? { id: 'pd-1' } : null
        )) as any);

  test('returns false when next_owner_role is unchanged', async () => {
    const c = makeCircuitCarcasse();
    const result = await notifyCircuitCourt(c as any, c as any, actingUser);
    expect(result).toBe(false);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('returns false when the new next_owner_role is not circuit court (e.g. ETG)', async () => {
    const existing = makeCircuitCarcasse({ next_owner_role: null });
    const updated = makeCircuitCarcasse({ next_owner_role: FeiOwnerRole.ETG });
    const result = await notifyCircuitCourt(existing as any, updated as any, actingUser);
    expect(result).toBe(false);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('notifies the destinataire and auto-closes when every carcasse of the lot is circuit court', async () => {
    const existing = makeCircuitCarcasse({ next_owner_role: null });
    const updated = makeCircuitCarcasse();
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([
      {
        UserRelatedWithEntity: {
          id: 'commerce-user',
          email: 'c@example.fr',
          prenom: 'Commerce',
          nom_de_famille: 'User',
          notifications: [],
          web_push_tokens: [],
          native_push_tokens: [],
        },
      },
    ] as any);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([updated] as any);
    mockUsersByIds();

    const result = await notifyCircuitCourt(existing as any, updated as any, actingUser);

    expect(result).toBe(true);
    // seul le destinataire (≠ acteur) est notifié
    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    expect(sendNotificationToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailTemplateId: BrevoTemplateId.FEI_ASSIGNED_CIRCUIT_COURT,
        emailTemplateParams: {
          sender_name: 'Pierre Petit',
          fei_numero: feiNumero,
          recipient_email: 'c@example.fr',
          cta: `${VITE_APP_URL}/app/circuit-court/fei/${feiNumero}/commerce-1`,
        },
      })
    );
    // le PDF de la fiche est joint, rendu une seule fois pour tous les destinataires
    expect(vi.mocked(sendNotificationToUser).mock.calls[0][0].attachments).toEqual([
      { content: 'base64pdf', name: `${feiNumero}.pdf` },
    ]);
    // tout le lot est en circuit court → clôture automatique par carcasse
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: {
        fei_numero: feiNumero,
        premier_detenteur_prochain_detenteur_id_cache: 'commerce-1',
        deleted_at: null,
      },
      data: { svi_automatic_closed_at: expect.any(Date) },
    });
  });

  test('does NOT auto-close when a carcasse of the lot is not circuit court', async () => {
    const existing = makeCircuitCarcasse({ next_owner_role: null });
    const updated = makeCircuitCarcasse();
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      updated,
      makeCircuitCarcasse({
        zacharie_carcasse_id: `${feiNumero}_BR-B`,
        next_owner_role: null,
        current_owner_role: FeiOwnerRole.ETG,
      }),
    ] as any);
    mockUsersByIds();

    const result = await notifyCircuitCourt(existing as any, updated as any, actingUser);

    expect(result).toBe(true);
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
  });
});

// Le side-effect tourne une fois par carcasse alors que l'email couvre toute la fiche : c'est la
// dédup de sendNotificationToUser sur `notificationLogAction` qui garantit un seul envoi par user
// SVI. Contourner le service (envoi Brevo direct) rendrait le nombre d'emails proportionnel au
// nombre de carcasses.
describe('notifySviAssignment', () => {
  const sviEntityId = 'svi-entity-1';

  const makeSviCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: `${feiNumero}_BR-A`,
    fei_numero: feiNumero,
    examinateur_initial_user_id: 'exam-1',
    premier_detenteur_user_id: 'pd-1',
    premier_detenteur_prochain_detenteur_id_cache: 'etg-1',
    svi_entity_id: sviEntityId,
    current_owner_entity_id: sviEntityId,
    next_owner_role: FeiOwnerRole.SVI,
    ...overrides,
  });

  const expectedAction = `FEI_ASSIGNED_TO_${FeiOwnerRole.SVI}_etg-1_${feiNumero}`;

  beforeEach(() => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'svi-user-1', email: 'svi1@example.fr' },
      { id: 'svi-user-2', email: 'svi2@example.fr' },
    ] as any);
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'exam-1' } as any);
  });

  test('returns false when the carcasse was already assigned to the SVI', async () => {
    const c = makeSviCarcasse();
    expect(await notifySviAssignment(c as any, c as any)).toBe(false);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('returns false when the new next_owner_role is not the SVI', async () => {
    const existing = makeSviCarcasse({ next_owner_role: null });
    const updated = makeSviCarcasse({ next_owner_role: FeiOwnerRole.ETG });
    expect(await notifySviAssignment(existing as any, updated as any)).toBe(false);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('notifies each SVI user via the Brevo template, never bypassing the notification service', async () => {
    const existing = makeSviCarcasse({ next_owner_role: null });
    const updated = makeSviCarcasse();

    expect(await notifySviAssignment(existing as any, updated as any)).toBe(true);

    expect(sendNotificationToUser).toHaveBeenCalledTimes(2);
    expect(sendNotificationToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'svi-user-1' }),
        emailTemplateId: BrevoTemplateId.FEI_TRANSMITTED_TO_SVI,
        emailTemplateParams: { entity_name: 'ETG 1', count: 3 },
        notificationLogAction: expectedAction,
      })
    );
    // l'envoi doit passer par le service (dédup + préférence EMAIL + push), jamais par Brevo direct
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  test('every carcasse of the fiche emits the same notificationLogAction, so the service dedups', async () => {
    const carcasses = ['BR-A', 'BR-B', 'BR-C'].map((bracelet) =>
      makeSviCarcasse({ zacharie_carcasse_id: `${feiNumero}_${bracelet}` })
    );

    for (const updated of carcasses) {
      await notifySviAssignment({ ...updated, next_owner_role: null } as any, updated as any);
    }

    // 3 carcasses × 2 users SVI = 6 appels, tous sur la même action → 2 emails après dédup
    expect(sendNotificationToUser).toHaveBeenCalledTimes(6);
    const actions = vi.mocked(sendNotificationToUser).mock.calls.map(([p]) => p.notificationLogAction);
    expect(new Set(actions)).toEqual(new Set([expectedAction]));
  });
});

// Le `cta` du template porte le seul lien de l'email : s'il perd le préfixe `/app`, le destinataire
// tombe sur la page 404 du site vitrine. D'où l'URL assertée en entier.
describe('notifyNextOwnerUser', () => {
  const actingUser = { id: 'pd-1', prenom: 'Pierre', nom_de_famille: 'Petit' } as any;

  const makeCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: `${feiNumero}_BR-A`,
    fei_numero: feiNumero,
    premier_detenteur_prochain_detenteur_id_cache: 'etg-1',
    next_owner_user_id: 'etg-user-1',
    next_owner_role: FeiOwnerRole.ETG,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockImplementation((({ where }: any) =>
      Promise.resolve(
        where.id === 'etg-user-1'
          ? { id: 'etg-user-1', roles: [UserRoles.ETG], email: 'etg@example.fr' }
          : where.id === 'ex-owner-1'
            ? { id: 'ex-owner-1', roles: [UserRoles.COLLECTEUR_PRO], email: 'ex@example.fr' }
            : null
      )) as any);
  });

  test('no-op quand le next owner ne change pas', async () => {
    const c = makeCarcasse({ next_owner_user_id: 'etg-user-1' });
    await notifyNextOwnerUser(c as any, c as any, actingUser);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('notifie le next owner via le template FEI_ASSIGNED, avec un lien vers son espace', async () => {
    const existing = makeCarcasse({ next_owner_user_id: null });
    const updated = makeCarcasse();

    await notifyNextOwnerUser(existing as any, updated as any, actingUser);

    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    expect(sendNotificationToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'etg-user-1' }),
        emailTemplateId: BrevoTemplateId.FEI_ASSIGNED,
        emailTemplateParams: {
          sender_name: 'Pierre Petit',
          fei_numero: feiNumero,
          cta: `${VITE_APP_URL}/app/etg/fei/${feiNumero}/etg-1`,
        },
        notificationLogAction: `FEI_ASSIGNED_TO_${FeiOwnerRole.ETG}_${feiNumero}_etg-1`,
      })
    );
  });

  test("prévient l'ancien destinataire du retrait, sans lien vers la fiche", async () => {
    const existing = makeCarcasse({ next_owner_user_id: 'ex-owner-1' });
    const updated = makeCarcasse();

    await notifyNextOwnerUser(existing as any, updated as any, actingUser);

    expect(sendNotificationToUser).toHaveBeenCalledTimes(2);
    expect(sendNotificationToUser).toHaveBeenLastCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'ex-owner-1' }),
        emailTemplateId: BrevoTemplateId.FEI_UNASSIGNED,
        emailTemplateParams: { sender_name: 'Pierre Petit', fei_numero: feiNumero },
        notificationLogAction: `FEI_REMOVED_FROM_${FeiOwnerRole.ETG}_${feiNumero}_etg-1`,
      })
    );
  });
});

describe('notifyNextOwnerEntity', () => {
  const actingUser = { id: 'pd-1', prenom: 'Pierre', nom_de_famille: 'Petit' } as any;

  const makeCarcasse = (overrides: any = {}) => ({
    zacharie_carcasse_id: `${feiNumero}_BR-A`,
    fei_numero: feiNumero,
    examinateur_initial_user_id: 'exam-1',
    premier_detenteur_user_id: 'exam-1',
    premier_detenteur_prochain_detenteur_id_cache: 'collecteur-1',
    next_owner_entity_id: 'collecteur-1',
    next_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'exam-1' } as any);
  });

  test("no-op quand l'entité destinataire ne change pas", async () => {
    const c = makeCarcasse();
    await notifyNextOwnerEntity(c as any, c as any, actingUser);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('notifie chaque user de l’entité (sauf l’acteur) via FEI_ASSIGNED, lien selon son rôle', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([
      {
        UserRelatedWithEntity: {
          id: 'collecteur-user',
          email: 'collecteur@example.fr',
          roles: [UserRoles.COLLECTEUR_PRO],
          notifications: [],
          web_push_tokens: [],
          native_push_tokens: [],
        },
      },
      // l'acteur travaille aussi pour l'entité : il ne se notifie pas lui-même
      { UserRelatedWithEntity: { id: 'pd-1', email: 'pd@example.fr', roles: [UserRoles.CHASSEUR] } },
    ] as any);

    const existing = makeCarcasse({ next_owner_entity_id: null });
    const updated = makeCarcasse();

    await notifyNextOwnerEntity(existing as any, updated as any, actingUser);

    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    expect(sendNotificationToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'collecteur-user' }),
        emailTemplateId: BrevoTemplateId.FEI_ASSIGNED,
        emailTemplateParams: {
          sender_name: 'Pierre Petit',
          fei_numero: feiNumero,
          cta: `${VITE_APP_URL}/app/collecteur-pro/fei/${feiNumero}/collecteur-1`,
        },
        notificationLogAction: `FEI_ASSIGNED_TO_${FeiOwnerRole.COLLECTEUR_PRO}_${feiNumero}_collecteur-1`,
      })
    );
  });
});
