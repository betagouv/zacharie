import { Carcasse, CarcasseStatus, CarcasseType, IPM1Decision, IPM2Decision } from '@prisma/client';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
import dayjs from 'dayjs';

export default function updateCarcasseStatus<T extends Carcasse | CarcasseForResponseForRegistry>(
  carcasse: T,
) {
  if (carcasse.intermediaire_carcasse_manquante) {
    return CarcasseStatus.MANQUANTE_ETG_COLLECTEUR;
  }
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
    return CarcasseStatus.REFUS_ETG_COLLECTEUR;
  }
  if (!carcasse.svi_ipm1_date && !carcasse.svi_ipm2_date) {
    if (dayjs().diff(dayjs(carcasse.svi_assigned_to_fei_at), 'day') > 10) {
      return CarcasseStatus.ACCEPTE;
    }
    if (carcasse.svi_carcasse_status === CarcasseStatus.ACCEPTE) {
      return CarcasseStatus.ACCEPTE;
    }
    return CarcasseStatus.SANS_DECISION;
  }
  if (!carcasse.svi_ipm1_presentee_inspection && !carcasse.svi_ipm2_presentee_inspection) {
    return CarcasseStatus.MANQUANTE_SVI;
  }
  if (carcasse.svi_ipm2_traitement_assainissant?.length > 0) {
    return CarcasseStatus.TRAITEMENT_ASSAINISSANT;
  }
  if (carcasse.svi_ipm2_decision?.includes(IPM2Decision.SAISIE_TOTALE)) {
    return CarcasseStatus.SAISIE_TOTALE;
  }
  if (carcasse.svi_ipm2_decision?.includes(IPM2Decision.SAISIE_PARTIELLE)) {
    return CarcasseStatus.SAISIE_PARTIELLE;
  }
  if (carcasse.svi_ipm2_decision?.includes(IPM2Decision.LEVEE_DE_LA_CONSIGNE)) {
    return CarcasseStatus.LEVEE_DE_CONSIGNE;
  }
  if (carcasse.svi_ipm2_decision?.includes(IPM2Decision.TRAITEMENT_ASSAINISSANT)) {
    return CarcasseStatus.TRAITEMENT_ASSAINISSANT;
  }
  if (carcasse.svi_ipm1_decision?.includes(IPM1Decision.MISE_EN_CONSIGNE)) {
    return CarcasseStatus.CONSIGNE;
  }
  if (dayjs().diff(dayjs(carcasse.svi_assigned_to_fei_at), 'day') > 10) {
    return CarcasseStatus.ACCEPTE;
  }
  return CarcasseStatus.SANS_DECISION;
}

export function getCarcasseStatusLabel<T extends CarcasseForResponseForRegistry>(carcasse: T) {
  switch (carcasse.svi_carcasse_status) {
    case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
    case CarcasseStatus.MANQUANTE_SVI:
      if (carcasse.type === CarcasseType.PETIT_GIBIER) {
        return 'Manquant';
      }
      return 'Manquante';
    case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
      return 'En traitement assainissant';
    case CarcasseStatus.SAISIE_TOTALE:
      return 'Saisie totale';
    case CarcasseStatus.SAISIE_PARTIELLE:
      return 'Saisie partielle';
    case CarcasseStatus.LEVEE_DE_CONSIGNE:
      return 'Levée de consigne';
    case CarcasseStatus.CONSIGNE:
      if (carcasse.type === CarcasseType.PETIT_GIBIER) {
        return 'Consigné';
      }
      return 'Consignée';
    default:
    case CarcasseStatus.SANS_DECISION:
      if (carcasse.svi_carcasse_status_set_at || carcasse.svi_carcasse_archived) {
        if (carcasse.type === CarcasseType.PETIT_GIBIER) {
          return 'Accepté';
        }
        return 'Acceptée';
      }
      return 'Sans décision';
  }
}

export function getSimplifiedCarcasseStatus(carcasse: Carcasse) {
  switch (carcasse.svi_carcasse_status) {
    case CarcasseStatus.SANS_DECISION:
    case CarcasseStatus.CONSIGNE:
    default:
      return 'en cours de traitement';
    case CarcasseStatus.ACCEPTE:
    case CarcasseStatus.LEVEE_DE_CONSIGNE:
    case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
      return 'accepté';
    case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
    case CarcasseStatus.REFUS_ETG_COLLECTEUR:
    case CarcasseStatus.MANQUANTE_SVI:
    case CarcasseStatus.SAISIE_TOTALE:
    case CarcasseStatus.SAISIE_PARTIELLE:
      return 'refusé';
  }
}
