import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';
import { sendOnboardingEmailOnce } from '~/utils/send-onboarding-email';
import { formatRelanceProfilIncompletEmail } from '~/utils/format-inscription-email';

export async function initRelanceInscriptionCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'Relance inscription profil incomplet',
          // every hour
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

// Relance unique des chasseurs ayant créé leur compte mais non terminé leur inscription
// (onboarded_at non renseigné), 24h après la création.
// Garde-fou : on borne à 7 jours pour ne pas relancer tout le backlog historique au déploiement.
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
  const { subject, text } = formatRelanceProfilIncompletEmail();
  for (const user of users) {
    await sendOnboardingEmailOnce({
      user,
      subject,
      text,
      action: 'RELANCE_PROFIL_INCOMPLET',
    });
  }
}
