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
    if (isRoleCircuitCourt(role)) return 'Clôturée';
    if (simpleStatus === 'Clôturée') {
      if (role === 'ETG') return 'Inspection vétérinaire terminée' satisfies TransmissionStepForEtg;
      if (role === 'CHASSEUR') return 'Carcasses traitées' satisfies TransmissionStepForChasseur;
      if (role === 'COLLECTEUR_PRO') return 'Carcasses traitées' satisfies TransmissionStepForCollecteurPro;
      return 'Clôturée';
    }
    if (role === 'CHASSEUR') {
      if (transmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
        if (!transmission.next_owner_role) {
          return 'Information manquante' satisfies TransmissionStepForChasseur;
        } else {
          return 'Validation par le premier détenteur' satisfies TransmissionStepForChasseur;
        }
      }
      if (transmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
        if (!transmission.next_owner_role) {
          return 'Validation par le premier détenteur' satisfies TransmissionStepForChasseur;
        } else {
          return 'Fiche envoyée, pas encore prise en charge' satisfies TransmissionStepForChasseur;
        }
      }
      if (transmission.current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
        return 'Prise en charge par le transporteur' satisfies TransmissionStepForChasseur;
      }
      return 'Traitement des carcasses' satisfies TransmissionStepForChasseur;
    }
    if (role === 'ETG') {
      if (transmission.svi_assigned_at) return 'Inspection par le SVI' satisfies TransmissionStepForEtg;
      if (transmission.current_owner_role === 'ETG') {
        if (transmission.next_owner_role === 'ETG') {
          if (!entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
            return 'Transport vers un autre établissement de traitement' satisfies TransmissionStepForEtg;
          } else {
            return 'Fiche reçue, pas encore prise en charge' satisfies TransmissionStepForEtg;
          }
        }
        if (entitiesIdsWorkingDirectlyFor[transmission.current_owner_entity_id!]) {
          return "Prise en charge par l'atelier" satisfies TransmissionStepForEtg;
        } else {
          return 'Prise en charge par un autre atelier' satisfies TransmissionStepForEtg;
        }
      }
      if (transmission.next_owner_role === 'ETG') {
        if (entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
          return 'Fiche reçue, pas encore prise en charge' satisfies TransmissionStepForEtg;
        }
        // so current is not ETG, next is ETG, but not me ? bug
        throw new Error('No current step label for ETG next/role');
      }
      if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
        return 'Prise en charge par le transporteur' satisfies TransmissionStepForEtg;
      }
    }
    if (role === 'COLLECTEUR_PRO') {
      if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
        if (transmission.next_owner_role === 'ETG') {
          return 'Transport vers un établissement de traitement' satisfies TransmissionStepForCollecteurPro;
        }
        return 'Transport' satisfies TransmissionStepForCollecteurPro;
      }
      if (transmission.next_owner_role === 'COLLECTEUR_PRO') {
        return 'Fiche reçue, pas encore prise en charge' satisfies TransmissionStepForCollecteurPro;
      }
      return 'Traitement des carcasses' satisfies TransmissionStepForCollecteurPro;
    }
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
