import { User, UserNotifications } from '@prisma/client';
import prisma from '~/prisma';
import { sendEmail, sendTemplateEmail } from '~/third-parties/brevo';

// Contenu de l'email : soit un template Brevo (sujet + HTML côté dashboard), soit du texte inline
// pour les emails pas encore migrés (cf. `brevo-templates.ts`).
type OnboardingEmailContent =
  | { templateId: number; params?: Record<string, unknown> }
  | { subject: string; text: string };

// Envoie un email d'inscription une seule fois par utilisateur (déduplication via NotificationLog
// sur la clé `action`). Contrairement à queueSendNotificationToUser, on force l'envoi même si
// l'utilisateur a désactivé les notifications EMAIL : ce sont des emails transactionnels d'inscription.
export async function sendOnboardingEmailOnce(
  props: { user: User; action: string } & OnboardingEmailContent
): Promise<boolean> {
  const { user, action } = props;
  if (!user.email) return false;

  const existing = await prisma.notificationLog.findFirst({
    where: { user_id: user.id, type: UserNotifications.EMAIL, action },
  });
  if (existing) return false;

  const sent =
    'templateId' in props
      ? await sendTemplateEmail({
          emails: [user.email],
          templateId: props.templateId,
          params: props.params,
        })
      : await sendEmail({ emails: [user.email], subject: props.subject, text: props.text });
  // Envoi raté : pas de log, sinon la dédup ci-dessus bloquerait définitivement le renvoi.
  if (!sent) return false;

  await prisma.notificationLog.create({
    data: {
      user_id: user.id,
      type: UserNotifications.EMAIL,
      email: user.email,
      action,
      payload: JSON.stringify(
        'templateId' in props
          ? { templateId: props.templateId, params: props.params }
          : { subject: props.subject, text: props.text }
      ),
    },
  });
  return true;
}
