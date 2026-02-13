import { Carcasse, IPM2Decision } from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import { formatCarcasseManquanteOrRefusEmail, formatSaisieEmail } from '~/utils/formatCarcasseEmail';
import { checkGenerateCertificat } from '~/utils/generate-certificats';

async function notifyExaminateurAndPremierDetenteur(
  fei_numero: string,
  title: string,
  email: string,
  notificationLogAction: string,
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

export async function notifySaisie(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    existingCarcasse.svi_ipm2_decision !== updatedCarcasse.svi_ipm2_decision &&
    (updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE ||
      updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE)
  ) {
    const [object, email] = formatSaisieEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_SAISIE_${updatedCarcasse.zacharie_carcasse_id}`,
    );
  }
}

export async function notifyManquante(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (!existingCarcasse.intermediaire_carcasse_manquante && updatedCarcasse.intermediaire_carcasse_manquante) {
    const [object, email] = await formatCarcasseManquanteOrRefusEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`,
    );
  }
}

export async function notifyRefus(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_motif
  ) {
    const [object, email] = await formatCarcasseManquanteOrRefusEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_REFUS_${updatedCarcasse.zacharie_carcasse_id}`,
    );
  }
}

export async function checkCertificat(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (updatedCarcasse.svi_ipm1_date || updatedCarcasse.svi_ipm2_date) {
    await checkGenerateCertificat(existingCarcasse, updatedCarcasse);
  }
}

export async function runCarcasseUpdateSideEffects(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  await notifySaisie(existingCarcasse, updatedCarcasse);
  await notifyManquante(existingCarcasse, updatedCarcasse);
  await notifyRefus(existingCarcasse, updatedCarcasse);
  await checkCertificat(existingCarcasse, updatedCarcasse);
}
