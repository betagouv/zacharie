import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';
import { sendOnboardingEmailOnce } from '~/utils/send-onboarding-email';
import { BrevoTemplateId } from '~/third-parties/brevo-templates';
import { VITE_APP_URL } from '~/config';

export async function initRelanceInscriptionCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'Relance inscription profil incomplet',
          cronTime: '0 * * * *',
          job: relanceProfilIncomplet,
          runOnInit: true,
        })
    )
    .then(() => {
      console.log('Relance inscription cron job is set up');
    })
    .catch(capture);
}

export async function relanceProfilIncomplet() {
  console.log('Relance inscription profil incomplet');
  const now = dayjs();
  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      onboarded_at: null,
      isZacharieAdmin: false,
      email: { not: null },
      roles: { has: UserRoles.CHASSEUR },
      created_at: {
        lte: now.subtract(24, 'hour').toDate(),
        gte: now.subtract(7, 'day').toDate(),
      },
    },
  });

  console.log(`Relance inscription : ${users.length} utilisateur(s) candidat(s)`);
  for (const user of users) {
    await sendOnboardingEmailOnce({
      user,
      templateId: BrevoTemplateId.RELANCE_PROFIL_INCOMPLET,
      params: { cta: `${VITE_APP_URL}/app/chasseur/onboarding/mes-coordonnees` },
      action: 'RELANCE_PROFIL_INCOMPLET',
    });
  }
}
