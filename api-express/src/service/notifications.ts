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

type WebPushNotification = {
  user: User;
  body: string;
  title: string;
  email: string;
  notificationLogAction: string;
  img?: string;
  attachments?: brevo.SendSmtpEmailAttachmentInner[];
  // Email migré vers un template Brevo : sujet + HTML gérés côté dashboard, remplis par
  // `emailTemplateParams`. Absent ou `null` = email encore en texte inline (`email`).
  // Cf. src/third-parties/brevo-templates.ts.
  emailTemplateId?: number | null;
  emailTemplateParams?: Record<string, unknown>;
};

export default async function queueSendNotificationToUser({
  user,
  body,
  title,
  email,
  notificationLogAction,
  attachments,
  emailTemplateId,
  emailTemplateParams,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: WebPushNotification) {
  await queue.add(async () => {
    await sendNotificationToUser({
      user,
      body,
      title,
      email,
      notificationLogAction,
      attachments,
      emailTemplateId,
      emailTemplateParams,
      img,
    });
  });
}

// Les deux canaux sont indépendants : un utilisateur qui a coché PUSH et EMAIL reçoit les deux, et
// l'échec de l'un ne doit ni empêcher l'autre ni faire remonter une erreur aux appelants (qui
// notifient souvent plusieurs utilisateurs à la suite).
async function sendNotificationToUser(notification: WebPushNotification) {
  const { user, title, body, email, img } = notification;
  if (user.notifications.includes(UserNotifications.PUSH)) {
    try {
      await sendPushToUser(notification);
    } catch (error) {
      console.error('error in push notification', user.id);
      Sentry.captureException(error, { extra: { user, body, email, title, img } });
    }
  }

  if (user.notifications.includes(UserNotifications.EMAIL)) {
    try {
      await sendEmailToUser(notification);
    } catch (error) {
      console.error('error in email notification', user.id);
      Sentry.captureException(error, { extra: { user, body, email, title, img } });
    }
  }
}

async function sendPushToUser({
  user,
  body,
  title,
  email,
  notificationLogAction,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: WebPushNotification) {
  const webPushTokens = user.web_push_tokens.filter((token) => !!token && token !== 'null');
  const nativePushTokens = user.native_push_tokens.filter((token) => !!token && token !== 'null');
  if (!webPushTokens.length && !nativePushTokens.length) {
    return;
  }
  // Une seule dédup pour les deux canaux : web et natif partagent le type `PUSH` du NotificationLog.
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
    for (const web_push_subscription of webPushTokens) {
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
  if (nativePushTokens.length) {
    console.log('SENDING NATIVE PUSH NOTIFICATION FOR REAL', user.id);
    const { sent, unregisteredTokens } = await sendExpoPushNotification({
      tokens: nativePushTokens,
      title,
      body,
    });
    // Expo signale les tokens périmés (app désinstallée) : on les retire pour ne pas les rejouer.
    // Le retrait se fait en SQL sur la valeur courante de la colonne, et non en réécrivant le
    // tableau du `user` en mémoire : celui-ci date du chargement de la tâche et écraserait un token
    // enregistré entre-temps (installation sur un nouvel appareil).
    if (unregisteredTokens.length) {
      try {
        await prisma.$executeRaw`
          UPDATE "User"
          SET native_push_tokens = ARRAY(
            SELECT token
            FROM unnest(native_push_tokens) AS token
            WHERE token NOT IN (${Prisma.join(unregisteredTokens)})
          )
          WHERE id = ${user.id}
        `;
      } catch (error) {
        console.error('error while removing unregistered native push tokens', user.id);
        Sentry.captureException(error, { extra: { user, unregisteredTokens } });
      }
    }
    // Envoi raté : on n'écrit pas le log, sinon la dédup bloquerait définitivement le renvoi.
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
          extra: { user, body, email, title, img },
        });
      }
    }
  }
  // await prisma.user.update({
  //   where: { id: user.id },
  //   data: { badge_count: { increment: 1 } },
  // });
}

async function sendEmailToUser({
  user,
  body,
  title,
  email,
  notificationLogAction,
  attachments,
  emailTemplateId,
  emailTemplateParams,
  img = 'https://zacharie.beta.gouv.fr/favicon.svg',
}: WebPushNotification) {
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
  // On attend l'envoi avant de rendre la main : c'est le `notificationLog.create` qui porte la
  // dédup, et la notification suivante fait son `findFirst` dès que la tâche PQueue courante est
  // terminée.
  const sent = emailTemplateId
    ? await sendTemplateEmail({
        emails: [user.email!],
        templateId: emailTemplateId,
        params: emailTemplateParams,
        attachments: attachments,
      })
    : await sendEmail({
        emails: [user.email!],
        subject: title,
        text: email,
        attachments: attachments,
      });
  // Envoi raté : on n'écrit pas le log, sinon la dédup bloquerait définitivement le renvoi.
  // Les senders remontent déjà l'erreur à Sentry.
  if (!sent) {
    console.error('error in send email', user.id);
    return;
  }
  try {
    await prisma.notificationLog.create({
      data: {
        user_id: user.id,
        payload: JSON.stringify({
          title,
          body,
          email,
          emailTemplateId,
          emailTemplateParams,
        }),
        type: 'EMAIL',
        email: user.email,
        action: notificationLogAction,
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { user, body, email, title, img },
    });
  }
}
