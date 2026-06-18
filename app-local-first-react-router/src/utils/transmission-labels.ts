import type {
  TransmissionStep,
  TransmissionStepForChasseur,
  TransmissionStepForCollecteurPro,
  TransmissionStepForEtg,
  TransmissionStepForTransportOrSoustraite,
  TransmissionStepGeneric,
  TransmissionSimpleStatus,
  TransmissionNextStep,
} from '@app/types/transmission-steps';
import { FeiOwnerRole, UserRoles } from '@prisma/client';
import { useEntitiesIdsWorkingDirectlyForObj } from '@app/utils/get-entity-relations';
import { createElement } from 'react';
import {
  RiCheckboxCircleLine,
  RiEdit2Line,
  RiTruckLine,
  RiDoorOpenLine,
  RiHourglassFill,
} from 'react-icons/ri';
import { ReactElement } from 'react';
import { CarcasseTransmission } from '@app/types/carcasse';
import { isRoleCircuitCourt } from './circuit-court';
import { capture } from '@app/services/sentry';

export function getTransmissionLabels(
  simpleStatus: TransmissionSimpleStatus,
  transmission: CarcasseTransmission,
  role: UserRoles,
  entitiesIdsWorkingDirectlyFor: ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>
) {
  const currentStepLabel = getCurrentStepLabel(
    simpleStatus,
    transmission,
    role,
    entitiesIdsWorkingDirectlyFor
  );
  const nextStepLabel = getNextStepLabel(currentStepLabel);
  const transportOrSoustraiteLabel = getTransportOrSoustraiteLabel(
    transmission,
    entitiesIdsWorkingDirectlyFor,
    currentStepLabel
  );
  return {
    simpleStatus,
    currentStepLabel,
    nextStepLabel,
    transportOrSoustraiteLabel,
  };
}

export function getCurrentStepLabel(
  simpleStatus: TransmissionSimpleStatus,
  transmission: CarcasseTransmission,
  role: UserRoles,
  entitiesIdsWorkingDirectlyFor: ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>
): TransmissionStep {
  try {
    // Circuit court (commerce de détail, boucher, ...) is a passive viewer : la fiche est toujours clôturée pour lui.
    if (isRoleCircuitCourt(role)) return 'Clôturée';
    // Le libellé est propre à chaque rôle (chaque fonction gère ses états clôturé et en cours).
    if (role === 'CHASSEUR') {
      return getCurrentStepLabelForChasseur(simpleStatus, transmission);
    }
    if (role === 'ETG') {
      return getCurrentStepLabelForEtg(simpleStatus, transmission, entitiesIdsWorkingDirectlyFor);
    }
    if (role === 'COLLECTEUR_PRO') {
      return getCurrentStepLabelForCollecteurPro(simpleStatus, transmission);
    }
    if (simpleStatus === 'Clôturée') return 'Clôturée';
    return 'En cours' satisfies TransmissionStepGeneric;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    capture(error, {
      extra: {
        transmission,
        simpleStatus,
        role,
        entitiesIdsWorkingDirectlyFor,
      },
      tags: {
        simpleStatus,
        role,
        fei_numero: transmission.fei_numero,
      },
    });
  }
  return 'En cours';
}

// Côté chasseur (examinateur initial / premier détenteur) : où en est sa fiche.
export function getCurrentStepLabelForChasseur(
  simpleStatus: TransmissionSimpleStatus,
  transmission: CarcasseTransmission
): TransmissionStepForChasseur {
  if (simpleStatus === 'Clôturée') return 'Carcasses traitées';
  if (transmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
    if (!transmission.next_owner_role) {
      return 'Information manquante';
    }
    return 'Validation par le premier détenteur';
  }
  if (transmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
    if (!transmission.next_owner_role) {
      return 'Validation par le premier détenteur';
    }
    return 'Fiche envoyée, pas encore prise en charge';
  }
  if (transmission.current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
    return 'Prise en charge par le transporteur';
  }
  return 'Traitement des carcasses';
}

// Côté ETG (établissement de traitement) : réception, prise en charge, transport entre ateliers, SVI.
export function getCurrentStepLabelForEtg(
  simpleStatus: TransmissionSimpleStatus,
  transmission: CarcasseTransmission,
  entitiesIdsWorkingDirectlyFor: ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>
): TransmissionStep {
  // une fiche est clôturée quand aucune des carcasse n'est toujours en cours
  if (simpleStatus === 'Clôturée') {
    if (transmission.svi_assigned_at) {
      return 'Inspection vétérinaire terminée' satisfies TransmissionStepForEtg;
    }
    return 'Carcasses refusées' satisfies TransmissionStepForEtg;
  }
  if (transmission.svi_assigned_at) return 'Inspection par le SVI' satisfies TransmissionStepForEtg;
  if (transmission.current_owner_role === 'ETG') {
    if (transmission.next_owner_role === 'ETG') {
      if (!entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
        return 'Transport vers un autre établissement de traitement' satisfies TransmissionStepForEtg;
      }
      return 'Fiche reçue, pas encore prise en charge' satisfies TransmissionStepForEtg;
    }
    if (entitiesIdsWorkingDirectlyFor[transmission.current_owner_entity_id!]) {
      return "Prise en charge par l'atelier" satisfies TransmissionStepForEtg;
    }
    return 'Prise en charge par un autre atelier' satisfies TransmissionStepForEtg;
  }
  if (transmission.next_owner_role === 'ETG') {
    if (entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
      return 'Fiche reçue, pas encore prise en charge' satisfies TransmissionStepForEtg;
    }
    // current n'est pas ETG, next est ETG, mais pas le mien ? bug
    throw new Error('No current step label for ETG next/role');
  }
  if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
    return 'Prise en charge par le transporteur' satisfies TransmissionStepForEtg;
  }
  return 'En cours' satisfies TransmissionStepGeneric;
}

// Côté collecteur professionnel : transport vers un ETG, réception, traitement.
export function getCurrentStepLabelForCollecteurPro(
  simpleStatus: TransmissionSimpleStatus,
  transmission: CarcasseTransmission
): TransmissionStepForCollecteurPro {
  if (simpleStatus === 'Clôturée') return 'Carcasses traitées';
  if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
    if (transmission.next_owner_role === 'ETG') {
      return 'Transport vers un établissement de traitement';
    }
    return 'Transport';
  }
  if (transmission.next_owner_role === 'COLLECTEUR_PRO') {
    return 'Fiche reçue, pas encore prise en charge';
  }
  return 'Traitement des carcasses';
}

export function getNextStepLabel(currentStepLabel: TransmissionStep): TransmissionNextStep {
  switch (currentStepLabel) {
    case 'Transport':
    case 'Transport vers un établissement de traitement':
    case 'Transport vers un autre établissement de traitement':
      return 'Réception par un établissement de traitement';
    case 'Information manquante':
      return 'Validation par le premier détenteur';
    case 'Fiche envoyée, pas encore prise en charge':
    case 'Prise en charge par un autre atelier':
    case 'Fiche reçue, pas encore prise en charge':
    case 'Prise en charge par le transporteur':
    case "Prise en charge par l'atelier":
    case 'Validation par le premier détenteur':
      return 'Traitement des carcasses';
    case 'Inspection vétérinaire terminée':
    case 'Carcasses traitées':
    case 'Inspection par le SVI':
    case 'Traitement des carcasses':
    case 'En cours':
    case 'Clôturée':
    default:
      return 'Clôturée';
  }
}

export function IconStep({
  displayLabel,
  simpleStatus,
}: {
  displayLabel: string;
  simpleStatus: TransmissionSimpleStatus;
}): ReactElement {
  if (simpleStatus === 'Clôturée') return createElement(RiCheckboxCircleLine);
  if (displayLabel === 'Information manquante') return createElement(RiEdit2Line);
  if (/transport/i.test(displayLabel)) return createElement(RiTruckLine);
  if (/atelier/i.test(displayLabel)) return createElement(RiDoorOpenLine);
  return createElement(RiHourglassFill);
}

export function getTransportOrSoustraiteLabel(
  currentTransmission: CarcasseTransmission,
  entitiesIdsWorkingDirectlyFor: ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>,
  currentStepLabel: string
): TransmissionStepForTransportOrSoustraite {
  if (currentTransmission.next_owner_sous_traite_by_entity_id) {
    if (entitiesIdsWorkingDirectlyFor[currentTransmission.next_owner_sous_traite_by_entity_id]) {
      const wasSoustraitant =
        currentTransmission.prev_owner_entity_id ===
          currentTransmission.next_owner_sous_traite_by_entity_id ||
        currentTransmission.current_owner_entity_id ===
          currentTransmission.next_owner_sous_traite_by_entity_id;
      const feiIsStillSoutraitée = !wasSoustraitant;
      if (feiIsStillSoutraitée) {
        return 'Sous-traitée';
      }
    }
  }
  if (currentStepLabel === 'Transport') {
    return 'Transporté';
  }
  return '';
}
