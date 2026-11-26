import webpush from 'web-push';
import * as brevo from '@getbrevo/brevo';
import { Prisma, type User, UserNotifications } from '@prisma/client';
import * as Sentry from '@sentry/node';
import PQueue from 'p-queue';
import { sendEmail, sendTemplateEmail } from '~/third-parties/brevo';
import prisma from '../prisma';
import { IS_TEST } from '~/config';
import { sendExpoPushNotification } from '~/third-parties/expo-push';

const queue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: process.env.NODE_ENV === 'production' ? 1000 : 0,
});
let count = 0;
queue.on('active', () => {
  console.log(`Working on item #${++count}.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

queue.on('add', () => {
  console.log(`Task is added.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

queue.on('next', () => {
  console.log(`Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

export type PushWording = {
  title: string;
  body: string;
  url?: string;
};

type NotificationToUser = {
  user: User;
  push: PushWording;
  title: string;
  email: string;
  notificationLogAction: string;
  img?: string;
  attachments?: brevo.SendSmtpEmailAttachmentInner[];
  emailTemplateId?: number | null;
  emailTemplateParams?: Record<string, unknown>;
  emailHtml?: string;
  cc?: Array<string>;
};

export type EmailResult =
  | { status: 'SENT'; messageId: string | null }
  | { status: 'FAILED' }
  | { status: 'SKIPPED' };

export default async function queueSendNotificationToUser({
  user,
  push,
  title,
  email,
  notificationLogAction,
  attachments,
  emailTemplateId,
  emailTemplateParams,
  emailHtml,
  cc,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: NotificationToUser): Promise<EmailResult> {
  const result = await queue.add(async () => {
    return sendNotificationToUser({
      user,
      push,
      title,
      email,
      notificationLogAction,
      attachments,
      emailTemplateId,
      emailTemplateParams,
      emailHtml,
      cc,
      img,
    });
  });
  return result || { status: 'FAILED' };
}

async function sendNotificationToUser(notification: NotificationToUser): Promise<EmailResult> {
  const { user, title, push, email, img } = notification;
  if (user.notifications.includes(UserNotifications.PUSH)) {
    try {
      await sendPushToUser(notification);
    } catch (error) {
      console.error('error in push notification', user.id);
      Sentry.captureException(error, { extra: { userId: user.id, push, email, title, img } });
    }
  }

  if (!user.notifications.includes(UserNotifications.EMAIL)) {
    return { status: 'SKIPPED' };
  }
  try {
    return await sendEmailToUser(notification);
  } catch (error) {
    console.error('error in email notification', user.id);
    Sentry.captureException(error, { extra: { userId: user.id, push, email, title, img } });
    return { status: 'FAILED' };
  }
}

async function sendPushToUser({
  user,
  push,
  email,
  notificationLogAction,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: NotificationToUser) {
  const { title, body, url } = push;
  const webPushTokens = user.web_push_tokens.filter((token) => !!token && token !== 'null');
  const nativePushTokens = user.native_push_tokens.filter((token) => !!token && token !== 'null');
  if (!webPushTokens.length && !nativePushTokens.length) {
    return;
  }
  const existingNotification = await prisma.notificationLog.findFirst({
    where: {
      user_id: user.id,
      type: 'PUSH',
      action: notificationLogAction,
    },
  });
  if (existingNotification) {
    console.log('Push notification already sent', user.id);
    return;
  }
  if (IS_TEST) {
    console.log(
      'SENDING PUSH NOTIFICATION IN DEV',
      JSON.stringify({ user, body, title, email, notificationLogAction, img }, null, 2)
    );
    await prisma.notificationLog.create({
      data: {
        user_id: user.id,
        payload: JSON.stringify({
          title,
          body,
          email,
          response: JSON.stringify({ message: 'Push not sent in dev' }),
        }),
        type: 'PUSH',
        web_push_token: webPushTokens[0] ?? null,
        action: notificationLogAction,
      },
    });
    return;
  }
  if (webPushTokens.length) {
    console.log('SENDING WEB PUSH NOTIFICATION FOR REAL', user.id);
    const webTokensToRemove: string[] = [];
    for (const web_push_subscription of webPushTokens) {
      try {
        const response = await webpush.sendNotification(
          JSON.parse(web_push_subscription),
          JSON.stringify({ title, body, img }),
          {
            vapidDetails: {
              subject: 'mailto:contact@zacharie.beta.gouv.fr',
              publicKey: process.env.VITE_VAPID_PUBLIC_KEY!,
              privateKey: process.env.VITE_VAPID_PRIVATE_KEY!,
            },
            urgency: 'high',
          }
        );
        console.log('web push response', response);
        await prisma.notificationLog.create({
          data: {
            user_id: user.id,
            payload: JSON.stringify({
              title,
              body,
              email,
              response,
            }),
            type: 'PUSH',
            web_push_token: web_push_subscription,
            action: notificationLogAction,
          },
        });
      } catch (error) {
        const statusCode = error instanceof webpush.WebPushError ? error.statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          webTokensToRemove.push(web_push_subscription);
          continue;
        }
        console.error('error in web push');
        console.error(error, user.id, title);
        Sentry.captureException(error, {
          extra: { userId: user.id, title, body, img, statusCode },
        });
      }
    }
    if (webTokensToRemove.length) {
      try {
        await prisma.$executeRaw`
          UPDATE "User"
          SET web_push_tokens = ARRAY(
            SELECT token
            FROM unnest(web_push_tokens) AS token
            WHERE token NOT IN (${Prisma.join(webTokensToRemove)})
          )
          WHERE id = ${user.id}
        `;
      } catch (error) {
        console.error('error while removing web push tokens', user.id);
        Sentry.captureException(error, {
          extra: { userId: user.id, tokensToRemoveCount: webTokensToRemove.length },
        });
      }
    }
  }
  if (nativePushTokens.length) {
    console.log('SENDING NATIVE PUSH NOTIFICATION FOR REAL', user.id);
    const { sent, tokensToRemove } = await sendExpoPushNotification({
      tokens: nativePushTokens,
      title,
      body,
      url,
    });
    if (tokensToRemove.length) {
      try {
        await prisma.$executeRaw`
          UPDATE "User"
          SET native_push_tokens = ARRAY(
            SELECT token
            FROM unnest(native_push_tokens) AS token
            WHERE token NOT IN (${Prisma.join(tokensToRemove)})
          )
          WHERE id = ${user.id}
        `;
      } catch (error) {
        console.error('error while removing native push tokens', user.id);
        Sentry.captureException(error, {
          extra: { userId: user.id, tokensToRemoveCount: tokensToRemove.length },
        });
      }
    }
    if (sent > 0) {
      try {
        await prisma.notificationLog.create({
          data: {
            user_id: user.id,
            payload: JSON.stringify({
              title,
              body,
              email,
              native_push_tokens: nativePushTokens,
              sent,
            }),
            type: 'PUSH',
            action: notificationLogAction,
          },
        });
      } catch (error) {
        Sentry.captureException(error, {
          extra: { userId: user.id, body, email, title, img },
        });
      }
    }
  }
}

async function sendEmailToUser({
  user,
  title,
  email,
  notificationLogAction,
  attachments,
  emailTemplateId,
  emailTemplateParams,
  emailHtml,
  cc,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: NotificationToUser): Promise<EmailResult> {
  const existingNotification = await prisma.notificationLog.findFirst({
    where: {
      user_id: user.id,
      type: 'EMAIL',
      action: notificationLogAction,
    },
  });
  if (existingNotification) {
    console.log('Email already sent', user.id);
    return { status: 'SKIPPED' };
  }
  if (IS_TEST) {
    console.log(
      'SENDING EMAIL NOTIFICATION IN DEV',
      JSON.stringify({ user: user.email, title, email, notificationLogAction, img }, null, 2)
    );
    await prisma.notificationLog.create({
      data: {
        user_id: user.id,
        payload: JSON.stringify({
          title,
          body: email,
          response: JSON.stringify({ message: 'Email not sent in dev' }),
        }),
        type: 'EMAIL',
        email: user.email,
        action: notificationLogAction,
      },
    });
    return { status: 'SENT', messageId: null };
  }
  console.log('SENDING EMAIL NOTIFICATION FOR REAL', user.id);
  const sent = emailTemplateId
    ? await sendTemplateEmail({
        emails: [user.email!],
        templateId: emailTemplateId,
        params: emailTemplateParams,
        attachments: attachments,
        cc,
      })
    : await sendEmail({
        emails: [user.email!],
        subject: title,
        text: email,
        html: emailHtml,
        attachments: attachments,
        cc,
      });
  if (!sent) {
    console.error('error in send email', user.id);
    return { status: 'FAILED' };
  }
  try {
    await prisma.notificationLog.create({
      data: {
        user_id: user.id,
        payload: JSON.stringify({
          title,
          body: email,
          emailTemplateId,
          emailTemplateParams,
          cc,
        }),
        type: 'EMAIL',
        email: user.email,
        action: notificationLogAction,
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId: user.id, email, title, img },
    });
  }
  return { status: 'SENT', messageId: sent.messageId };
}
