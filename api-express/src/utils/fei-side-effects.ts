import { Fei } from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { sendWebhook } from '~/utils/api';

export async function webhookApprobation(existingFei: Fei, savedFei: Fei) {
  if (
    existingFei.examinateur_initial_date_approbation_mise_sur_le_marche !==
    savedFei.examinateur_initial_date_approbation_mise_sur_le_marche
  ) {
    await sendWebhook(savedFei.examinateur_initial_user_id!, 'FEI_APPROBATION_MISE_SUR_LE_MARCHE', {
      feiNumero: savedFei.numero,
    });
  }
}

export async function syncCarcasseDates(existingFei: Fei, savedFei: Fei) {
  if (
    dayjs(existingFei.date_mise_a_mort).format('YYYY/MM/DD') !==
    dayjs(savedFei.date_mise_a_mort).format('YYYY/MM/DD')
  ) {
    await prisma.carcasse.updateMany({
      where: { fei_numero: savedFei.numero },
      data: { date_mise_a_mort: savedFei.date_mise_a_mort },
    });
  }
  if (existingFei.heure_mise_a_mort_premiere_carcasse !== savedFei.heure_mise_a_mort_premiere_carcasse) {
    await prisma.carcasse.updateMany({
      where: { fei_numero: savedFei.numero },
      data: { heure_mise_a_mort_premiere_carcasse_fei: savedFei.heure_mise_a_mort_premiere_carcasse },
    });
  }
  if (existingFei.heure_evisceration_derniere_carcasse !== savedFei.heure_evisceration_derniere_carcasse) {
    await prisma.carcasse.updateMany({
      where: { fei_numero: savedFei.numero },
      data: { heure_evisceration_derniere_carcasse_fei: savedFei.heure_evisceration_derniere_carcasse },
    });
  }
}

/**
 * Runs all side effects after a FEI update.
 * SVI assignment and circuit court notifications are mutually exclusive
 * with generic next-owner notifications (matches original early-return flow).
 */
export async function runFeiUpdateSideEffects(existingFei: Fei, savedFei: Fei) {
  await webhookApprobation(existingFei, savedFei);
  await syncCarcasseDates(existingFei, savedFei);
}
