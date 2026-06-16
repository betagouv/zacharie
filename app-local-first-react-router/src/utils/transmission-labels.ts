import type {
  FeiStep,
  FeiStepForChasseur,
  FeiStepForEtg,
  FeiStepForTransportOrSoustraite,
  FeiStepSimpleStatus,
} from '@app/types/fei-steps';
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
  simpleStatus: FeiStepSimpleStatus,
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
  return {
    simpleStatus,
    currentStepLabel,
    nextStepLabel,
  };
}

export function getCurrentStepLabel(
  simpleStatus: FeiStepSimpleStatus,
  transmission: CarcasseTransmission,
  role: UserRoles,
  entitiesIdsWorkingDirectlyFor: ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>
): FeiStep | FeiStepForEtg | FeiStepForChasseur {
  try {
    if (isRoleCircuitCourt(role)) return 'Clôturée';
    if (simpleStatus === 'Clôturée') {
      if (role === 'ETG') return 'Inspection vétérinaire terminée' as FeiStepForEtg;
      if (role === 'CHASSEUR') return 'Carcasses traitées';
      if (role === 'COLLECTEUR_PRO') return 'Carcasses traitées';
      return 'Clôturée';
    }
    if (role === 'CHASSEUR') {
      if (transmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
        if (!transmission.next_owner_role) {
          return 'Information manquante' satisfies FeiStepForChasseur;
        } else {
          return 'Validation par le premier détenteur' satisfies FeiStepForChasseur;
        }
      }
      if (transmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
        if (!transmission.next_owner_role) {
          return 'Validation par le premier détenteur' satisfies FeiStepForChasseur;
        } else {
          return 'Fiche envoyée, pas encore prise en charge' satisfies FeiStepForChasseur;
        }
      }
      if (transmission.current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
        return 'Prise en charge par le transporteur' satisfies FeiStepForChasseur;
      }
      return 'Traitement des carcasses' satisfies FeiStepForChasseur;
    }
    if (role === 'ETG') {
      if (transmission.svi_assigned_at) return 'Inspection par le SVI';
      if (transmission.current_owner_role === 'ETG') {
        if (transmission.next_owner_role === 'ETG') {
          if (!entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
            return 'Transport vers un autre établissement de traitement' satisfies FeiStepForEtg;
          } else {
            return 'Fiche reçue, pas encore prise en charge' satisfies FeiStepForEtg;
          }
        }
        if (entitiesIdsWorkingDirectlyFor[transmission.current_owner_entity_id!]) {
          return "Prise en charge par l'atelier" satisfies FeiStepForEtg;
        } else {
          return 'Prise en charge par un autre atelier' satisfies FeiStepForEtg;
        }
      }
      if (transmission.next_owner_role === 'ETG') {
        if (entitiesIdsWorkingDirectlyFor[transmission.next_owner_entity_id!]) {
          return 'Fiche reçue, pas encore prise en charge' satisfies FeiStepForEtg;
        }
        // so current is not ETG, next is ETG, but not me ? bug
        throw new Error('No current step label for ETG next/role');
      }
      if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
        return 'Prise en charge par le transporteur' satisfies FeiStepForEtg;
      }
    }
    if (role === 'COLLECTEUR_PRO') {
      if (transmission.current_owner_role === 'COLLECTEUR_PRO') {
        if (transmission.next_owner_role === 'ETG') {
          return 'Transport vers un établissement de traitement';
        }
        return 'Transport';
      }
      if (transmission.next_owner_role === 'COLLECTEUR_PRO') {
        return 'Fiche envoyée, pas encore prise en charge';
      }
      return 'Traitement des carcasses';
    }
    return 'En cours';
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

export function getNextStepLabel(currentStepLabel: FeiStep | FeiStepForEtg | FeiStepForChasseur): FeiStep {
  switch (currentStepLabel) {
    case 'En cours':
      return 'Clôturée';
    case 'Clôturée':
      return 'Clôturée';
    case 'Examen initial':
      return 'Validation par le premier détenteur';
    case 'Validation par le premier détenteur':
      return 'Traitement des carcasses';
    case 'Transport':
      return 'Réception par un établissement de traitement';
    case 'Transport vers un établissement de traitement':
      return 'Réception par un établissement de traitement';
    case 'Transport vers un autre établissement de traitement':
      return 'Réception par un établissement de traitement';
    case 'Transport vers / réception par un établissement de traitement':
      return 'Réception par un établissement de traitement';
    case 'Fiche envoyée, pas encore traitée':
      return 'Traitement des carcasses';
    case 'Réception par un établissement de traitement':
      return 'Inspection par le SVI';
    case 'Inspection par le SVI':
      return 'Clôturée';
    case 'Carcasses traitées':
      return 'Clôturée';
    case 'Fiche reçue, pas encore prise en charge':
      return 'Traitement des carcasses';
    case 'Prise en charge par le transporteur':
      return 'Traitement des carcasses';
    case "Prise en charge par l'atelier":
      return 'Traitement des carcasses';
    case 'Prise en charge par un autre atelier':
      return 'Traitement des carcasses';
    case 'Fiche envoyée, pas encore prise en charge':
      return 'Traitement des carcasses';
    case 'Inspection vétérinaire terminée':
      return 'Clôturée';
    case 'Information manquante':
      return 'Validation par le premier détenteur';
    case 'Traitement des carcasses':
      return 'Clôturée';
    default:
      return 'Clôturée';
  }
}

export function IconStep({
  displayLabel,
  simpleStatus,
}: {
  displayLabel: string;
  simpleStatus: FeiStepSimpleStatus;
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
): FeiStepForTransportOrSoustraite {
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
