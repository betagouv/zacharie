import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import { sendEmail, sendTemplateEmail } from '~/third-parties/brevo';
import { sendExpoPushNotification } from '~/third-parties/expo-push';
import webpush from 'web-push';
import * as Sentry from '@sentry/node';
import queueSendNotificationToUser from '~/service/notifications';

vi.mock('~/config', () => ({ IS_TEST: false, SENTRY_KEY: '' }));
vi.mock('~/third-parties/brevo', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  sendTemplateEmail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
}));
vi.mock('web-push', () => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { default: { sendNotification: vi.fn(), WebPushError } };
});
vi.mock('~/third-parties/expo-push', () => ({
  sendExpoPushNotification: vi.fn().mockResolvedValue({ sent: 1, tokensToRemove: [] }),
}));

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
  email: 'Un texte inline',
  push: { title: 'Un titre push', body: 'Un corps push' },
  notificationLogAction: 'FEI_ASSIGNED_TO_SVI_etg-1_ZACH-TEST-001',
};

describe('sendNotificationToUser — canal email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notificationLog.create).mockResolvedValue({} as any);
    vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1' });
    vi.mocked(sendTemplateEmail).mockResolvedValue({ messageId: 'msg-1' });
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

  test('transmet la copie (cc) à Brevo', async () => {
    await queueSendNotificationToUser({
      ...notification,
      emailTemplateId: 78,
      cc: ['expediteur@example.fr'],
    });

    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ cc: ['expediteur@example.fr'] })
    );
  });

  test('renvoie SENT avec le messageId Brevo quand l’envoi réussit', async () => {
    const result = await queueSendNotificationToUser(notification);

    expect(result).toEqual({ status: 'SENT', messageId: 'msg-1' });
  });

  test('renvoie FAILED quand l’envoi échoue', async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);

    const result = await queueSendNotificationToUser(notification);

    expect(result).toEqual({ status: 'FAILED' });
  });

  test('renvoie SKIPPED quand l’email a déjà été envoyé', async () => {
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue({ id: 'log-1' } as any);

    const result = await queueSendNotificationToUser(notification);

    expect(result).toEqual({ status: 'SKIPPED' });
  });

  test('renvoie SKIPPED quand l’utilisateur a désactivé les emails', async () => {
    const result = await queueSendNotificationToUser({
      ...notification,
      user: { ...user, notifications: [] },
    });

    expect(result).toEqual({ status: 'SKIPPED' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('sendNotificationToUser — canaux push et email', () => {
  const pushAndEmailUser = {
    ...user,
    notifications: ['PUSH', 'EMAIL'],
    native_push_tokens: ['ExponentPushToken[abc]'],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notificationLog.create).mockResolvedValue({} as any);
    vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1' });
    vi.mocked(sendExpoPushNotification).mockResolvedValue({ sent: 1, tokensToRemove: [] });
  });

  test('envoie le push ET l’email quand les deux canaux sont activés', async () => {
    await queueSendNotificationToUser({ ...notification, user: pushAndEmailUser });

    expect(sendExpoPushNotification).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  test('envoie le wording push, pas le contenu de l’email', async () => {
    await queueSendNotificationToUser({ ...notification, user: pushAndEmailUser });

    expect(sendExpoPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Un titre push', body: 'Un corps push' })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Un titre', text: 'Un texte inline' })
    );
  });

  test('envoie l’email même quand le push a déjà été envoyé', async () => {
    vi.mocked(prisma.notificationLog.findFirst).mockImplementation((({ where }: any) =>
      Promise.resolve(where.type === 'PUSH' ? { id: 'log-1' } : null)) as any);

    await queueSendNotificationToUser({ ...notification, user: pushAndEmailUser });

    expect(sendExpoPushNotification).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  test('envoie l’email même quand le push jette', async () => {
    vi.mocked(sendExpoPushNotification).mockRejectedValue(new Error('expo down'));

    await queueSendNotificationToUser({ ...notification, user: pushAndEmailUser });

    expect(sendEmail).toHaveBeenCalled();
  });

  test('retire les tokens périmés sans réécrire le tableau du user en mémoire', async () => {
    vi.mocked(sendExpoPushNotification).mockResolvedValue({
      sent: 0,
      tokensToRemove: ['ExponentPushToken[abc]'],
    });

    await queueSendNotificationToUser({ ...notification, user: pushAndEmailUser });

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('sendNotificationToUser — web push', () => {
  const webPushUser = {
    ...user,
    notifications: ['PUSH'],
    web_push_tokens: [
      '{"endpoint":"https://push.example/expired"}',
      '{"endpoint":"https://push.example/ok"}',
    ],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notificationLog.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notificationLog.create).mockResolvedValue({} as any);
  });

  test('retire un abonnement expiré sans remonter d’erreur à Sentry', async () => {
    vi.mocked(webpush.sendNotification).mockImplementation((async (subscription: any) => {
      if (subscription.endpoint.endsWith('expired')) {
        throw new (webpush.WebPushError as any)('Received unexpected response code', 410);
      }
      return { statusCode: 201 };
    }) as any);
    const captureSpy = vi.spyOn(Sentry, 'captureException');

    await queueSendNotificationToUser({ ...notification, user: webPushUser });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('remonte les autres erreurs à Sentry avec le statusCode, sans retirer l’abonnement', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(
      new (webpush.WebPushError as any)('Received unexpected response code', 500)
    );
    const captureSpy = vi.spyOn(Sentry, 'captureException');

    await queueSendNotificationToUser({ ...notification, user: webPushUser });

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(captureSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ extra: expect.objectContaining({ statusCode: 500 }) })
    );
  });
});
