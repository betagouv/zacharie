import webpush from "web-push";
import { type User, UserNotifications } from "@prisma/client";
import * as Sentry from "@sentry/node";
import { sendEmail } from "./sendEmail";

type WebPushNotification = {
  user: User;
  body: string;
  title: string;
  email: string;
  img?: string;
};

export default async function sendNotificationToUser({
  user,
  body,
  title,
  email,
  img = "https://zacharie.beta.gouv.fr/favicon.svg",
}: WebPushNotification) {
  if (user.notifications.includes(UserNotifications.PUSH)) {
    if (user.web_push_tokens?.length) {
      console.log("SENDING WEB PUSH NOTIFICATION", user.id);
      for (const web_push_subscription of user.web_push_tokens) {
        if (!web_push_subscription) {
          continue;
        }
        if (web_push_subscription === "null") {
          continue;
        }
        webpush
          .sendNotification(JSON.parse(web_push_subscription), JSON.stringify({ title, body, img }), {
            vapidDetails: {
              subject: "mailto:contact@zacharie.beta.gouv.fr",
              publicKey: process.env.VITE_VAPID_PUBLIC_KEY!,
              privateKey: process.env.VITE_VAPID_PRIVATE_KEY!,
            },
            urgency: "high",
          })
          .then((response) => {
            console.log("web push response", response);
          })
          .catch((error) => {
            console.error("error in web push");
            console.error(error, web_push_subscription, title, body, img);
            Sentry.captureException(error, {
              extra: { web_push_subscription, title, body, img },
            });
          });
      }
    }
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { badge_count: { increment: 1 } },
    // });
  }
  console.log(user.notifications);
  if (user.notifications.includes(UserNotifications.EMAIL)) {
    console.log("SENDING EMAIL NOTIFICATION", user.id);
    sendEmail({
      emails: import.meta.env.DEV ? ["arnaud@ambroselli.io"] : [user.email!],
      subject: title,
      text: email,
      html: email,
    }).catch((error) => {
      console.error("error in send email");
      console.error(error);
      Sentry.captureException(error, {
        extra: { user, body, email, title, img },
      });
    });
  }
}
