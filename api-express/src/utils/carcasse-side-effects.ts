import { Carcasse, IPM2Decision } from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import {
  formatCarcasseManquanteOrRefusChasseurEmail,
  formatManualValidationSviChasseurEmail,
  formatSaisieChasseurEmail,
} from '~/utils/formatCarcasseEmail';
import { checkGenerateCertificat } from '~/utils/generate-certificats';
import { isCarcasseDone } from '~/utils/is-carcasse-done';
import { sendWebhook } from '~/utils/api';

async function notifyExaminateurAndPremierDetenteur(
  fei_numero: string,
  title: string,
  email: string,
  notificationLogAction: string
) {
  const [examinateurInitial, premierDetenteur] = await prisma.fei
    .findUnique({
      where: { numero: fei_numero },
      include: {
        FeiExaminateurInitialUser: true,
        FeiPremierDetenteurUser: true,
      },
    })
    .then((fei) => {
      return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
    });

  await sendNotificationToUser({
    user: examinateurInitial!,
    title,
    body: email,
    email,
    notificationLogAction,
  });

  if (premierDetenteur?.id !== examinateurInitial?.id) {
    await sendNotificationToUser({
      user: premierDetenteur!,
      title,
      body: email,
      email,
      notificationLogAction,
    });
  }
}

export async function notifySaisieChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    existingCarcasse.svi_ipm2_decision !== updatedCarcasse.svi_ipm2_decision &&
    (updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE ||
      updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE)
  ) {
    const [object, email] = formatSaisieChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_SAISIE_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

export async function notifyManquanteChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    !existingCarcasse.intermediaire_carcasse_manquante &&
    updatedCarcasse.intermediaire_carcasse_manquante
  ) {
    const [object, email] = await formatCarcasseManquanteOrRefusChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

export async function notifyRefusChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_motif
  ) {
    const [object, email] = await formatCarcasseManquanteOrRefusChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_REFUS_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

export async function checkCertificat(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (updatedCarcasse.svi_ipm1_date || updatedCarcasse.svi_ipm2_date) {
    await checkGenerateCertificat(existingCarcasse, updatedCarcasse);
  }
}

// La clôture vit désormais par carcasse. Quand une carcasse vient d'être close au SVI ET que
// TOUTES les carcasses de la FEI sont terminales, on :
//   1. maintient le cache FEI Fei.svi_closed_at (consommé par les vues matérialisées et l'API
//      publique v1, qui ne lisent pas la clôture par carcasse) — pendant manuel de la clôture
//      auto qui écrit Fei.automatic_closed_at dans le cron ;
//   2. notifie examinateur + premier détenteur.
// Idempotent : l'écriture FEI est gardée par `!fei.svi_closed_at`, la notif/webhook par
// notificationLog (les carcasses sont persistées avant les side-effects, donc plusieurs d'entre
// elles peuvent voir "toutes terminales" dans le même lot).
export async function closeFeiAndNotifyChasseurOnSviCarcasseClose(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse
) {
  if (existingCarcasse.svi_closed_at || !updatedCarcasse.svi_closed_at) {
    return;
  }
  const fei = await prisma.fei.findUnique({
    where: { numero: updatedCarcasse.fei_numero },
    include: {
      FeiExaminateurInitialUser: true,
      FeiPremierDetenteurUser: true,
      Carcasses: { where: { deleted_at: null } },
    },
  });
  if (!fei) return;
  const allCarcassesDone = fei.Carcasses.length > 0 && fei.Carcasses.every(isCarcasseDone);
  if (!allCarcassesDone) return;

  // Cache FEI : écrit une seule fois, à la clôture complète de la fiche.
  // Date de fin d'inspection = clôture de carcasse la plus tardive (cf. DonneesDeChasse.tsx).
  if (!fei.svi_closed_at) {
    const latestCarcasseClosedAt = fei.Carcasses.reduce<Date | null>((latest, c) => {
      if (!c.svi_closed_at) return latest;
      return !latest || c.svi_closed_at > latest ? c.svi_closed_at : latest;
    }, null);
    await prisma.fei.update({
      where: { id: fei.id },
      data: {
        svi_closed_at: latestCarcasseClosedAt ?? updatedCarcasse.svi_closed_at,
        svi_closed_by_user_id: updatedCarcasse.svi_closed_by_user_id ?? fei.svi_user_id ?? null,
      },
    });
  }

  const action = `FEI_MANUAL_CLOSED_${fei.numero}`;
  const examinateur = fei.FeiExaminateurInitialUser;
  // Dédup explicite (notif ET webhook) : si déjà envoyé pour l'examinateur, on s'arrête.
  if (examinateur) {
    const already = await prisma.notificationLog.findFirst({
      where: { user_id: examinateur.id, action, deleted_at: null },
    });
    if (already) return;
  }

  const [object, email] = await formatManualValidationSviChasseurEmail(fei, fei.Carcasses);
  const notification = { title: object, body: email, email, notificationLogAction: action };

  if (examinateur) {
    await sendNotificationToUser({ user: examinateur, ...notification });
    await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: fei.numero });
  }
  const premierDetenteur = fei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendNotificationToUser({ user: premierDetenteur, ...notification });
    await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: fei.numero });
  }
}

export async function runCarcasseUpdateSideEffects(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  await notifySaisieChasseur(existingCarcasse, updatedCarcasse);
  await notifyManquanteChasseur(existingCarcasse, updatedCarcasse);
  await notifyRefusChasseur(existingCarcasse, updatedCarcasse);
  await closeFeiAndNotifyChasseurOnSviCarcasseClose(existingCarcasse, updatedCarcasse);
  await checkCertificat(existingCarcasse, updatedCarcasse);
}
