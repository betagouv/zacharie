// import { getAtmoIndicator } from '~/aggregators/indice_atmo.ts';
// import { getPollensIndicator } from '~/aggregators/pollens.ts';
// import { getIndiceUVIndicator } from '~/aggregators/indice_uv.ts';
// import { setupCronJob } from './utils';
// import { capture } from '~/third-parties/sentry';
// import { getWeatherAlert } from '~/aggregators/weather_alert';
// import { getBathingWaterIndicator } from '~/aggregators/bathing_water';
// // import { getDrinkingWaterIndicator } from '~/aggregators/drinking_water';

import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';
import prisma from '~/prisma';
import dayjs from 'dayjs';
import sendNotificationToUser from '~/service/notifications';
import { formatCarcasseChasseurEmail } from '~/utils/formatCarcasseEmail';
import updateCarcasseStatus from '~/utils/get-carcasse-status';

// /*
// *
// *

// Initialization of the cron jobs
// We call them one after the other,
// in order to avoid to launch them all at the same time
// and have logs that are mixed and not readable.

// Test it: run `npm run dev-cronjobs` and check the logs

// */

export async function initFeisCron() {
  await Promise.resolve()
    .then(() => {
      console.log('Inside feis cronjobs');
    })
    .then(
      async () =>
        await setupCronJob({
          name: 'Automatic Closing of Feis',
          // every day at 8am
          cronTime: '0 8 * * *',
          job: automaticClosingOfFeis,
          runOnInit: true,
        }),
    )
    .then(() => {
      console.log('All feis cron jobs are set up');
    })
    .catch(capture);
}

async function automaticClosingOfFeis() {
  console.log('Automatic closing of feis');
  const feisUnderSvi = await prisma.fei.findMany({
    where: {
      svi_assigned_at: {
        // start of day of assigned day is older than 10 days of start of day of today with dayjs
        lte: dayjs().subtract(10, 'days').startOf('day').toDate(),
      },
      svi_signed_at: null,
      automatic_closed_at: null,
    },
    include: {
      FeiExaminateurInitialUser: true,
      FeiPremierDetenteurUser: true,
      Carcasses: true,
    },
  });

  console.log(`Found ${feisUnderSvi.length} feis under svi that need to be closed`);
  for (const fei of feisUnderSvi) {
    const automaticClosedAt = dayjs().toDate();
    await prisma.fei.update({
      where: {
        id: fei.id,
      },
      data: {
        automatic_closed_at: automaticClosedAt,
      },
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('Skipping feis closing notif in development mode');
      continue;
    }
    const email = [
      `La fiche ${fei.numero} a été réceptionnée par le Service Vétérinaire il y a plus de 10 jours, elle est donc automatiquement clôturée.`,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche\u00A0:`,
      `https://zacharie.beta.gouv.fr/app/tableau-de-bord/${fei.numero}\n\n\n\n\n`,
      `Carcasses :\n\n\n`,
    ];
    for (let carcasse of fei.Carcasses) {
      const newStatus = updateCarcasseStatus(carcasse);
      if (newStatus !== carcasse.svi_carcasse_status) {
        carcasse = await prisma.carcasse.update({
          where: {
            zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
          },
          data: {
            svi_carcasse_status: newStatus,
            svi_carcasse_status_set_at: automaticClosedAt,
          },
        });
      }
      email.push(`${formatCarcasseChasseurEmail(carcasse)}\n\n`);
    }
    // auto close and notify examinateur and premier detenteut
    const notification = {
      title: 'Fiche clôturée automatiquement',
      body: 'La fiche a été réceptionnée par le Service Vétérinaire il y a plus de 10 jours, elle est donc automatiquement clôturée.',
      email: email.filter(Boolean).join('\n'),
      notificationLogAction: `FEI_AUTO_CLOSED_${fei.numero}`,
    };
    if (fei.FeiExaminateurInitialUser) {
      const examinateur = fei.FeiExaminateurInitialUser;
      if (examinateur) {
        await sendNotificationToUser({
          user: examinateur,
          ...notification,
        });
      }
    }
    if (fei.FeiPremierDetenteurUser && fei.FeiPremierDetenteurUser.id !== fei.FeiExaminateurInitialUser?.id) {
      const premierDetenteur = fei.FeiPremierDetenteurUser;
      if (premierDetenteur) {
        await sendNotificationToUser({
          user: premierDetenteur,
          ...notification,
        });
      }
    }
  }
}
