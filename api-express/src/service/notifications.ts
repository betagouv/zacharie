import webpush from 'web-push';
import * as brevo from '@getbrevo/brevo';
import { type User, UserNotifications } from '@prisma/client';
import * as Sentry from '@sentry/node';
import PQueue from 'p-queue';
import { sendEmail } from '~/third-parties/brevo';
import prisma from '../prisma';
import { IS_TEST } from '~/config';

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

type WebPushNotification = {
  user: User;
  body: string;
  title: string;
  email: string;
  notificationLogAction: string;
  img?: string;
  attachments?: brevo.SendSmtpEmailAttachmentInner[];
};

export default async function queueSendNotificationToUser(props: WebPushNotification) {
  await queue.add(async () => {
    await sendNotificationToUser(props);
  });
}

// Orchestrateur : push et email sont deux canaux distincts (vocations différentes), lancés
// en parallèle. Chacun est gated sur sa propre préférence user et déduplique indépendamment.
async function sendNotificationToUser(props: WebPushNotification) {
  await Promise.all([sendPushToUser(props), sendEmailToUser(props)]);
}

// Canal PUSH (web + natif). Gated sur la préférence PUSH, dédup sur NotificationLog (type PUSH).
export async function sendPushToUser({
  user,
  body,
  title,
  email,
  notificationLogAction,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: WebPushNotification) {
  if (!user.notifications.includes(UserNotifications.PUSH)) {
    return;
  }

  if (user.web_push_tokens?.length) {
    const existingNotification = await prisma.notificationLog.findFirst({
      where: {
        user_id: user.id,
        type: 'PUSH',
        action: notificationLogAction,
      },
    });
    if (existingNotification) {
      console.log('Notification already sent', user.id);
      return;
    }
    if (IS_TEST) {
      console.log(
        'SENDING WEB PUSH NOTIFICATION IN DEV',
        JSON.stringify({ user, body, title, email, notificationLogAction, img }, null, 2)
      );
      await prisma.notificationLog.create({
        data: {
          user_id: user.id,
          payload: JSON.stringify({
            title,
            body,
            email,
            response: JSON.stringify({ message: 'Web push not sent in dev' }),
          }),
          type: 'PUSH',
          web_push_token: user.web_push_tokens[0],
          action: notificationLogAction,
        },
      });
      return;
    }
    console.log('SENDING WEB PUSH NOTIFICATION FOR REAL', user.id);
    for (const web_push_subscription of user.web_push_tokens) {
      if (!web_push_subscription) {
        continue;
      }
      if (web_push_subscription === 'null') {
        continue;
      }
      webpush
        .sendNotification(JSON.parse(web_push_subscription), JSON.stringify({ title, body, img }), {
          vapidDetails: {
            subject: 'mailto:contact@zacharie.beta.gouv.fr',
            publicKey: process.env.VITE_VAPID_PUBLIC_KEY!,
            privateKey: process.env.VITE_VAPID_PRIVATE_KEY!,
          },
          urgency: 'high',
        })
        .then(async (response) => {
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
        })
        .catch((error) => {
          console.error('error in web push');
          console.error(error, web_push_subscription, title, body, img);
          Sentry.captureException(error, {
            extra: { web_push_subscription, title, body, img },
          });
        });
    }
  }
  if (user.native_push_tokens?.length) {
    const existingNotification = await prisma.notificationLog.findFirst({
      where: {
        user_id: user.id,
        type: 'PUSH',
        action: notificationLogAction,
      },
    });
    if (existingNotification) {
      console.log('Notification already sent', user.id);
      return;
    }
    if (IS_TEST) {
      console.log(
        'SENDING WEB PUSH NOTIFICATION IN DEV',
        JSON.stringify({ user, body, title, email, notificationLogAction, img }, null, 2)
      );
      await prisma.notificationLog.create({
        data: {
          user_id: user.id,
          payload: JSON.stringify({
            title,
            body,
            email,
            response: JSON.stringify({ message: 'Web push not sent in dev' }),
          }),
          type: 'PUSH',
          web_push_token: user.web_push_tokens[0],
          action: notificationLogAction,
        },
      });
      return;
    }
    console.log('SENDING WEB PUSH NOTIFICATION FOR REAL', user.id);
    for (const native_push_token of user.native_push_tokens) {
      if (!native_push_token) {
        continue;
      }
      if (native_push_token === 'null') {
        continue;
      }
      console.log('SENDING NATIVE PUSH NOTIFICATION FOR REAL', user.id, native_push_token);
    }
  }
  // await prisma.user.update({
  //   where: { id: user.id },
  //   data: { badge_count: { increment: 1 } },
  // });
}

// Canal EMAIL. Gated sur la préférence EMAIL, dédup sur NotificationLog (type EMAIL).
// NB: encore en texte brut (`sendEmail`). Migration progressive vers les templates Brevo
// via `sendTemplateEmail` — cf. src/third-parties/brevo-templates.ts.
export async function sendEmailToUser({
  user,
  body,
  title,
  email,
  notificationLogAction,
  attachments,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: WebPushNotification) {
  if (!user.notifications.includes(UserNotifications.EMAIL)) {
    return;
  }

  const existingNotification = await prisma.notificationLog.findFirst({
    where: {
      user_id: user.id,
      type: 'EMAIL',
      action: notificationLogAction,
    },
  });
  if (existingNotification) {
    console.log('Email already sent', user.id);
    return;
  }
  if (IS_TEST) {
    console.log(
      'SENDING EMAIL NOTIFICATION IN DEV',
      JSON.stringify({ user: user.email, body, title, email, notificationLogAction, img }, null, 2)
    );
    await prisma.notificationLog.create({
      data: {
        user_id: user.id,
        payload: JSON.stringify({
          title,
          body,
          email,
          response: JSON.stringify({ message: 'Email not sent in dev' }),
        }),
        type: 'EMAIL',
        email: user.email,
        action: notificationLogAction,
      },
    });
    return;
  }
  console.log('SENDING EMAIL NOTIFICATION FOR REAL', user.id);
  sendEmail({
    emails: [user.email!],
    subject: title,
    text: email,
    attachments: attachments,
  })
    .then(async (response) => {
      await prisma.notificationLog.create({
        data: {
          user_id: user.id,
          payload: JSON.stringify({
            title,
            body,
            email,
            response,
          }),
          type: 'EMAIL',
          email: user.email,
          action: notificationLogAction,
        },
      });
    })
    .catch((error) => {
      console.error('error in send email');
      console.error(error);
      Sentry.captureException(error, {
        extra: { user, body, email, title, img },
      });
    });
}
