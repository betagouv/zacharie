import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import { sendEmail, sendTemplateEmail } from '~/third-parties/brevo';
import queueSendNotificationToUser from '~/service/notifications';

// IS_TEST court-circuite la branche EMAIL avant l'envoi : on le force à false pour tester le vrai chemin.
// SENTRY_KEY est lu par third-parties/sentry.ts, importé via third-parties/expo-push.ts.
vi.mock('~/config', () => ({ IS_TEST: false, SENTRY_KEY: '' }));
vi.mock('~/third-parties/brevo', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendTemplateEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));

// notifications: ['EMAIL'] uniquement, sinon la branche PUSH `return` avant l'email.
const user = {
  id: 'user-1',
  email: 'user@example.fr',
  notifications: ['EMAIL'],
  web_push_tokens: [],
  native_push_tokens: [],
} as any;

const notification = {
  user,
  title: 'Un titre',
  body: 'Un corps',
  email: 'Un texte inline',
  notificationLogAction: 'FEI_ASSIGNED_TO_SVI_etg-1_ZACH-TEST-001',
};

describe('sendNotificationToUser — canal email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notificationLog.create).mockResolvedValue({} as any);
    vi.mocked(sendEmail).mockResolvedValue(true);
    vi.mocked(sendTemplateEmail).mockResolvedValue(true);
  });

  test('route vers le template Brevo quand emailTemplateId est fourni', async () => {
    await queueSendNotificationToUser({
      ...notification,
      emailTemplateId: 78,
      emailTemplateParams: { entity_name: 'ETG 1', count: 3 },
    });

    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [user.email],
        templateId: 78,
        params: { entity_name: 'ETG 1', count: 3 },
      })
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('route vers le texte inline quand il n’y a pas de emailTemplateId', async () => {
    await queueSendNotificationToUser(notification);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [user.email],
        subject: notification.title,
        text: notification.email,
      })
    );
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  // Le notificationLog porte la dédup : l'écrire après un envoi raté bloquerait le renvoi pour toujours.
  test('n’écrit pas de notificationLog quand l’envoi inline échoue', async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);

    await queueSendNotificationToUser(notification);

    expect(sendEmail).toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  test('n’écrit pas de notificationLog quand l’envoi template échoue', async () => {
    vi.mocked(sendTemplateEmail).mockResolvedValue(false);

    await queueSendNotificationToUser({ ...notification, emailTemplateId: 78 });

    expect(sendTemplateEmail).toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  test('écrit le notificationLog quand l’envoi réussit', async () => {
    await queueSendNotificationToUser({ ...notification, emailTemplateId: 78 });

    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
    const { data } = vi.mocked(prisma.notificationLog.create).mock.calls[0][0];
    expect(data).toMatchObject({
      user_id: user.id,
      type: 'EMAIL',
      email: user.email,
      action: notification.notificationLogAction,
    });
    expect(JSON.parse(data.payload as string)).toMatchObject({ emailTemplateId: 78 });
  });

  test('n’envoie rien quand la notification a déjà été envoyée', async () => {
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue({ id: 'log-1' } as any);

    await queueSendNotificationToUser(notification);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });
});
