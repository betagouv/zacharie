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
import {
  formatAutomaticClosingEmailForChasseur,
  formatCarcasseChasseurEmail,
} from '~/utils/formatCarcasseEmail';
import updateCarcasseStatus from '~/utils/get-carcasse-status';
import { isCarcasseDone } from '~/utils/is-carcasse-done';
import { sendWebhook } from '~/utils/api';
import { CarcasseModificationRequestStatus, FeiOwnerRole } from '@prisma/client';

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
        })
    )
    .then(() => {
      console.log('All feis cron jobs are set up');
    })
    .catch(capture);
}

export async function automaticClosingOfFeis() {
  console.log('Automatic closing of feis');
  // Auto-clôture PAR CARCASSE : chaque carcasse assignée au SVI depuis plus de 10 jours
  // est clôturée individuellement. La FEI n'est marquée close que lorsque TOUTES ses
  // carcasses sont dans un état terminal (multi-destinataire : les lots progressent séparément).
  const carcassesToAutoClose = await prisma.carcasse.findMany({
    where: {
      svi_assigned_at: {
        // start of day of assigned day is older than 10 days of start of day of today
        lte: dayjs().subtract(10, 'days').startOf('day').toDate(),
      },
      svi_closed_at: null,
      svi_automatic_closed_at: null,
      deleted_at: null,
      // Skip carcasses with a pending modif request — the examinateur initial has not yet
      // approved/rejected, so the inspection cycle is not complete for this carcasse.
      CarcasseModificationRequests: {
        none: {
          status: CarcasseModificationRequestStatus.PENDING,
          deleted_at: null,
        },
      },
    },
  });

  console.log(`Found ${carcassesToAutoClose.length} carcasses to auto-close`);
  if (process.env.NODE_ENV === 'development') {
    console.log('Skipping feis closing notif in development mode');
    return;
  }

  const automaticClosedAt = dayjs().toDate();
  for (const carcasse of carcassesToAutoClose) {
    const newStatus = updateCarcasseStatus(carcasse);
    const user = await prisma.user.findUnique({
      where: {
        id: carcasse.svi_user_id,
      },
    });
    const entity = await prisma.entity.findUnique({
      where: {
        id: carcasse.svi_entity_id,
      },
    });
    await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      },
      data: {
        svi_carcasse_status: newStatus,
        svi_carcasse_status_set_at: automaticClosedAt,
        svi_automatic_closed_at: automaticClosedAt,
        current_owner_role: FeiOwnerRole.SVI,
        current_owner_entity_id: carcasse.svi_entity_id,
        current_owner_user_id: carcasse.svi_user_id || null,
        current_owner_user_name_cache: user ? `${user.prenom} ${user.nom_de_famille}` : null,
        current_owner_entity_name_cache: entity ? (entity.nom_d_usage ?? entity.raison_sociale) : null,
        prev_owner_entity_id:
          carcasse.current_owner_entity_id === carcasse.svi_entity_id
            ? carcasse.prev_owner_entity_id
            : carcasse.current_owner_entity_id,
        prev_owner_role:
          carcasse.current_owner_role === FeiOwnerRole.SVI
            ? carcasse.prev_owner_role
            : carcasse.current_owner_role,
        prev_owner_user_id:
          carcasse.current_owner_user_id === carcasse.svi_user_id
            ? carcasse.prev_owner_user_id
            : carcasse.current_owner_user_id,
        next_owner_role: null,
        next_owner_user_id: null,
        next_owner_entity_id: null,
        next_owner_entity_name_cache: null,
      },
    });
  }

  // Pour chaque FEI touchée : clôturer la FEI + notifier uniquement si TOUTES ses carcasses sont terminales.
  const transmissionsNumeros = [
    ...new Set(
      carcassesToAutoClose.map((c) => `${c.fei_numero}_${c.premier_detenteur_prochain_detenteur_id_cache}`)
    ),
  ];
  for (const transmission of transmissionsNumeros) {
    const [fei_numero, premier_detenteur_prochain_detenteur_id_cache] = transmission.split('_');
    const carcasses = await prisma.carcasse.findMany({
      where: {
        fei_numero,
        premier_detenteur_prochain_detenteur_id_cache,
        deleted_at: null,
      },
    });
    const allCarcassesDone = carcasses.every(isCarcasseDone);
    if (!allCarcassesDone) continue;

    const [object, email] = await formatAutomaticClosingEmailForChasseur(fei_numero, carcasses);
    // auto close and notify examinateur and premier detenteur
    const notification = {
      title: object,
      body: email,
      email: email,
      notificationLogAction: `FEI_AUTO_CLOSED_${fei_numero}_${premier_detenteur_prochain_detenteur_id_cache}`,
    };
    const examinateur = await prisma.user.findUnique({
      where: { id: carcasses[0].examinateur_initial_user_id },
    });
    if (examinateur) {
      await sendNotificationToUser({
        user: examinateur,
        ...notification,
      });
      await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: fei_numero });
    }
    if (carcasses[0].premier_detenteur_user_id !== carcasses[0].examinateur_initial_user_id) {
      const premierDetenteur = await prisma.user.findUnique({
        where: { id: carcasses[0].premier_detenteur_user_id },
      });
      if (premierDetenteur) {
        await sendNotificationToUser({
          user: premierDetenteur,
          ...notification,
        });
        await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: fei_numero });
      }
    }
  }
}
