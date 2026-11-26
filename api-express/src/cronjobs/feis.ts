import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';
import prisma from '~/prisma';
import dayjs from 'dayjs';
import sendNotificationToUser from '~/service/notifications';
import { formatFeiClosedEmail, formatCarcasseChasseurEmail } from '~/utils/formatCarcasseEmail';
import updateCarcasseStatus from '~/utils/get-carcasse-status';
import { isCarcasseDone } from '~/utils/is-carcasse-done';
import { sendWebhook } from '~/utils/api';
import { FeiOwnerRole, Prisma } from '@prisma/client';
import { TRICHINE_FEATURE_ENABLED } from '~/config';
import { carcasseAvecTrichineNegatifFilter, TRICHINE_ESPECE_CONCERNEE } from '~/utils/trichine';
import { nextVersion } from '~/utils/sync-version';
import { BrevoTemplateId } from '~/third-parties/brevo-templates';

export async function initFeisCron() {
  await Promise.resolve()
    .then(() => {
      console.log('Inside feis cronjobs');
    })
    .then(
      async () =>
        await setupCronJob({
          name: 'Automatic Closing of Feis',
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

export function getCarcassesToAutoCloseWhere(): Prisma.CarcasseWhereInput {
  return {
    svi_assigned_at: {
      lte: dayjs().subtract(10, 'days').startOf('day').toDate(),
    },
    svi_closed_at: null,
    svi_automatic_closed_at: null,
    deleted_at: null,
  };
}

type AutomaticClosingOptions = {
  force?: boolean;
};

export async function automaticClosingOfFeis({ force = false }: AutomaticClosingOptions = {}) {
  console.log('Automatic closing of feis');
  const carcassesToAutoClose = await prisma.carcasse.findMany({
    where: {
      ...getCarcassesToAutoCloseWhere(),
      ...(TRICHINE_FEATURE_ENABLED
        ? {
            OR: [
              { espece: null },
              { espece: { not: TRICHINE_ESPECE_CONCERNEE } },
              carcasseAvecTrichineNegatifFilter,
            ],
          }
        : {}),
    },
  });

  console.log(`Found ${carcassesToAutoClose.length} carcasses to auto-close`);
  if (process.env.NODE_ENV === 'development' && !force) {
    console.log('Skipping feis closing notif in development mode');
    return;
  }

  const automaticClosedAt = dayjs().toDate();
  for (const carcasse of carcassesToAutoClose) {
    const newStatus = updateCarcasseStatus(carcasse);

    const user = carcasse.svi_user_id
      ? await prisma.user.findUnique({
          where: {
            id: carcasse.svi_user_id,
          },
        })
      : null;
    const entity = carcasse.svi_entity_id
      ? await prisma.entity.findUnique({
          where: {
            id: carcasse.svi_entity_id,
          },
        })
      : null;

    await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      },
      data: {
        svi_carcasse_status: newStatus,
        svi_carcasse_status_set_at: automaticClosedAt,
        svi_automatic_closed_at: automaticClosedAt,
        ...nextVersion(null),
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

  const transmissions = new Map<
    string,
    { fei_numero: string; premier_detenteur_prochain_detenteur_id_cache: string | null }
  >();
  for (const c of carcassesToAutoClose) {
    const key = JSON.stringify([c.fei_numero, c.premier_detenteur_prochain_detenteur_id_cache]);
    transmissions.set(key, {
      fei_numero: c.fei_numero,
      premier_detenteur_prochain_detenteur_id_cache: c.premier_detenteur_prochain_detenteur_id_cache,
    });
  }
  for (const { fei_numero, premier_detenteur_prochain_detenteur_id_cache } of transmissions.values()) {
    try {
      await notifyTransmissionClosed(fei_numero, premier_detenteur_prochain_detenteur_id_cache);
    } catch (error) {
      capture(error as Error, { extra: { fei_numero, premier_detenteur_prochain_detenteur_id_cache } });
    }
  }
}

async function notifyTransmissionClosed(
  fei_numero: string,
  premier_detenteur_prochain_detenteur_id_cache: string | null
) {
  const carcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero,
      premier_detenteur_prochain_detenteur_id_cache,
      deleted_at: null,
    },
  });
  if (carcasses.length === 0) return;
  const allCarcassesDone = carcasses.every(isCarcasseDone);
  if (!allCarcassesDone) return;

  const { object, text, params, push } = await formatFeiClosedEmail(fei_numero, carcasses);
  const notification = {
    title: object,
    email: text,
    push,
    notificationLogAction: `FEI_AUTO_CLOSED_${fei_numero}_${premier_detenteur_prochain_detenteur_id_cache}`,
    emailTemplateId: BrevoTemplateId.FEI_AUTOMATIC_CLOSED,
    emailTemplateParams: params,
  };
  const { examinateur_initial_user_id, premier_detenteur_user_id } = carcasses[0];
  const examinateur = examinateur_initial_user_id
    ? await prisma.user.findUnique({ where: { id: examinateur_initial_user_id } })
    : null;
  if (examinateur) {
    await sendNotificationToUser({
      user: examinateur,
      ...notification,
    });
    await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: fei_numero });
  }
  if (premier_detenteur_user_id && premier_detenteur_user_id !== examinateur_initial_user_id) {
    const premierDetenteur = await prisma.user.findUnique({ where: { id: premier_detenteur_user_id } });
    if (premierDetenteur) {
      await sendNotificationToUser({
        user: premierDetenteur,
        ...notification,
      });
      await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: fei_numero });
    }
  }
}
