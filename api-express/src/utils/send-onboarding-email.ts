import { User, UserNotifications } from '@prisma/client';
import prisma from '~/prisma';
import { sendEmail } from '~/third-parties/brevo';

// Envoie un email d'inscription une seule fois par utilisateur (déduplication via NotificationLog
// sur la clé `action`). Contrairement à queueSendNotificationToUser, on force l'envoi même si
// l'utilisateur a désactivé les notifications EMAIL : ce sont des emails transactionnels d'inscription.
export async function sendOnboardingEmailOnce({
  user,
  subject,
  text,
  action,
}: {
  user: User;
  subject: string;
  text: string;
  action: string;
}): Promise<boolean> {
  if (!user.email) return false;

  const existing = await prisma.notificationLog.findFirst({
    where: { user_id: user.id, type: UserNotifications.EMAIL, action },
  });
  if (existing) return false;

  await sendEmail({ emails: [user.email], subject, text });

  await prisma.notificationLog.create({
    data: {
      user_id: user.id,
      type: UserNotifications.EMAIL,
      email: user.email,
      action,
      payload: JSON.stringify({ subject, text }),
    },
  });
  return true;
}
