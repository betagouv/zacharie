import { User, UserNotifications } from '@prisma/client';
import prisma from '~/prisma';
import { sendTemplateEmail } from '~/third-parties/brevo';

export async function sendOnboardingEmailOnce({
  user,
  templateId,
  params,
  action,
}: {
  user: User;
  templateId: number;
  params?: Record<string, unknown>;
  action: string;
}): Promise<boolean> {
  if (!user.email) return false;

  const existing = await prisma.notificationLog.findFirst({
    where: { user_id: user.id, type: UserNotifications.EMAIL, action },
  });
  if (existing) return false;

  const sent = await sendTemplateEmail({ emails: [user.email], templateId, params });
  if (!sent) return false;

  await prisma.notificationLog.create({
    data: {
      user_id: user.id,
      type: UserNotifications.EMAIL,
      email: user.email,
      action,
      payload: JSON.stringify({ templateId, params }),
    },
  });
  return true;
}
