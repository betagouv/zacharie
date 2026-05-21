import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { FeiStep, FeiStepForChasseur, FeiStepForEtg, FeiStepSimpleStatus } from '@app/types/fei-steps';
import useUser from '@app/zustand/user';
import { Carcasse, Entity, EntityTypes, FeiOwnerRole, User, UserRoles } from '@prisma/client';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { createElement, useMemo } from 'react';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';
import { useFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import {
  RiCheckboxCircleLine,
  RiEdit2Line,
  RiTruckLine,
  RiDoorOpenLine,
  RiHourglassFill,
} from 'react-icons/ri';
import { ReactElement } from 'react';

type IntermediaireStep = {
  id: string | null;
  role: FeiOwnerRole;
  nextRole: FeiOwnerRole | null;
};

type UseFeiStepsReturn = {
  currentStep: number;
  currentStepLabel: FeiStep;
  currentStepLabelForEtg: FeiStepForEtg;
  currentStepLabelForChasseur: FeiStepForChasseur;
  nextStepLabel: FeiStep;
  currentStepLabelShort: string;
  simpleStatus: FeiStepSimpleStatus;
  steps: Array<IntermediaireStep>;
};

export function useFeiSteps(fei: FeiWithIntermediaires): UseFeiStepsReturn {
  const intermediaires = useFeiIntermediaires(fei.numero);
  const user = useUser((state) => state.user);
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const carcasses = useCarcassesForFei(fei.numero);

  const memoizedComputeFeiSteps = useMemo(() => {
    return computeFeiSteps({
      fei,
      intermediaires,
      entitiesIdsWorkingDirectlyFor,
      user,
      carcasses,
    });
  }, [fei, intermediaires, entitiesIdsWorkingDirectlyFor, user, carcasses]);
  return memoizedComputeFeiSteps;
}

interface ComputeFeiStepsParams {
  fei: FeiWithIntermediaires;
  intermediaires: Array<FeiIntermediaire>;
  entitiesIdsWorkingDirectlyFor: Array<Entity['id']>;
  user: User | null;
  carcasses?: Array<Carcasse>;
}

export function computeFeiSteps({
  fei,
  intermediaires,
  entitiesIdsWorkingDirectlyFor,
  user,
  carcasses,
}: ComputeFeiStepsParams): UseFeiStepsReturn {
  const currentTransmission = carcasses?.length
    ? carcasses[0]
    : {
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
        current_owner_user_id: fei.examinateur_initial_user_id,
        current_owner_user_name_cache: `${user?.prenom} ${user?.nom_de_famille}`,
        premier_detenteur_prochain_detenteur_role_cache: null,
        premier_detenteur_prochain_detenteur_id_cache: null,
        current_owner_entity_id: null,
        current_owner_entity_name_cache: null,
        next_owner_user_id: null,
        next_owner_user_name_cache: null,
        next_owner_entity_id: null,
        next_owner_entity_name_cache: null,
        next_owner_role: null,
        next_owner_sous_traite_by_entity_id: null,
        prev_owner_user_id: null,
        prev_owner_entity_id: null,
        prev_owner_role: null,
        consommateur_final_usage_domestique: null,
        svi_assigned_at: null,
        svi_closed_at: null,
        intermediaire_closed_at: null,
      };
  const steps: Array<IntermediaireStep> = (() => {
    if (currentTransmission.consommateur_final_usage_domestique) {
      return [
        {
          id: fei.examinateur_initial_user_id,
          role: FeiOwnerRole.EXAMINATEUR_INITIAL,
          nextRole: FeiOwnerRole.PREMIER_DETENTEUR,
        },
        {
          id: fei.premier_detenteur_user_id,
          role: FeiOwnerRole.PREMIER_DETENTEUR,
          nextRole: null,
        },
      ];
    }
    const _steps: Array<IntermediaireStep> = [
      {
        id: fei.examinateur_initial_user_id,
        role: FeiOwnerRole.EXAMINATEUR_INITIAL,
        nextRole: FeiOwnerRole.PREMIER_DETENTEUR,
      },
      {
        id: fei.premier_detenteur_entity_id || fei.premier_detenteur_user_id,
        role: FeiOwnerRole.PREMIER_DETENTEUR,
        nextRole: currentTransmission.premier_detenteur_prochain_detenteur_role_cache,
      },
    ];
    for (let i = intermediaires.length - 1; i >= 0; i--) {
      _steps.push({
        id: intermediaires[i].id,
        role: intermediaires[i].intermediaire_role as FeiOwnerRole,
        nextRole: intermediaires[i].intermediaire_prochain_detenteur_role_cache,
      });
    }
    if (currentTransmission.intermediaire_closed_at) return _steps;
    const lastStepIsEtgToSvi =
      _steps[_steps.length - 1]?.role === FeiOwnerRole.ETG &&
      (!_steps[_steps.length - 1]?.nextRole || _steps[_steps.length - 1]?.nextRole === FeiOwnerRole.SVI);
    if (!lastStepIsEtgToSvi) {
      // on simplifie ici : pour montrer à l'utilisateur qu'on anticipe une étape ETG puis SVI
      // mais peut-être que ça va changer, avec les circuits longs, les circuits courts...
      _steps.push({
        id: null,
        role: FeiOwnerRole.ETG,
        nextRole: FeiOwnerRole.SVI,
      });
    }
    _steps.push({
      id: null,
      role: FeiOwnerRole.SVI,
      nextRole: null,
    });
    return _steps;
  })();

  const currentStepIndex: number = (() => {
    // find role equal to currentTransmission.current_owner_role but in reverse order
    if (currentTransmission.consommateur_final_usage_domestique) return 1;
    if (currentTransmission.svi_assigned_at) return steps.length - 1; // step is SVI
    if (currentTransmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) return 0;
    if (currentTransmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) return 1;
    if (currentTransmission.intermediaire_closed_at) return steps.length - 1; // fei is closed
    const etgStep = steps[steps.length - 2];
    if (etgStep.id) return steps.length - 2; // etg is selected
    return steps.length - 3; // etg is not selected
  })();

  const currentStepLabel: FeiStep = (() => {
    if (
      // @ts-expect-error automatic_closed_at is not yet implemented
      currentTransmission.automatic_closed_at ||
      currentTransmission.svi_closed_at ||
      currentTransmission.intermediaire_closed_at
    ) {
      return 'Clôturée';
    }
    if (currentTransmission.consommateur_final_usage_domestique && fei.premier_detenteur_user_id) {
      return 'Clôturée';
    }
    if (currentTransmission.svi_assigned_at) return 'Inspection par le SVI';
    if (currentTransmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) return 'Examen initial';
    if (currentTransmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
      if (!currentTransmission.next_owner_role) {
        return 'Validation par le premier détenteur';
      } else {
        return 'Fiche envoyée, pas encore traitée';
      }
    }
    const avantDernierStep = steps[steps.length - 2]; // c'est toujours l'étape ETG vers SVI, qu'il soit sélectionné ou pas encore
    if (avantDernierStep.id) return 'Réception par un établissement de traitement';
    // pas encore d'ETG, on regarde l'étape précédente
    // pour simplifier :
    const currentStep = steps[steps.length - 3];
    if (!currentStep) return 'Examen initial'; // juste pour éviter un bug
    if (currentStep.role === FeiOwnerRole.COLLECTEUR_PRO) {
      if (currentStep.nextRole === EntityTypes.ETG) {
        return 'Transport vers un établissement de traitement';
      } else if (currentStep.nextRole === EntityTypes.COLLECTEUR_PRO) {
        return 'Transport';
      }
      // pas de nextRole donc on ne sait rien d'autre que : c'est un transport
      return 'Transport';
    }
    if (currentStep.role === FeiOwnerRole.ETG) {
      if (currentStep.nextRole === EntityTypes.ETG || currentStep.nextRole === EntityTypes.COLLECTEUR_PRO) {
        return 'Transport vers un autre établissement de traitement';
      }
      return 'Réception par un établissement de traitement';
    }
    // capture(`bug dans currentStepLabel for fei ${fei.numero}`, { extra: { fei, steps, currentStep } });
    return 'En cours';
  })();

  const nextStepLabel: FeiStep = (() => {
    switch (currentStepLabel) {
      case 'Examen initial':
        return 'Validation par le premier détenteur';
      case 'Validation par le premier détenteur':
        return 'Transport vers un établissement de traitement';
      case 'Fiche envoyée, pas encore traitée':
        return 'Transport vers / réception par un établissement de traitement';
      case 'Transport vers un établissement de traitement':
      case 'Transport vers un autre établissement de traitement':
      case 'Transport':
        return 'Réception par un établissement de traitement';
      case 'Réception par un établissement de traitement':
        // return '';
        return 'Inspection par le SVI';
      case 'Inspection par le SVI':
      default:
        return 'Clôturée';
    }
  })();

  const simpleStatus: FeiStepSimpleStatus = (() => {
    if (user?.roles.includes(UserRoles.CHASSEUR)) {
      switch (currentStepLabel) {
        case 'Examen initial':
          if (currentTransmission.next_owner_user_id) {
            if (currentTransmission.next_owner_user_id === user.id) {
              return 'À compléter';
            }
            return 'En cours';
          }
          return 'À compléter';
        case 'Validation par le premier détenteur':
          if (
            fei.premier_detenteur_user_id === user.id ||
            currentTransmission.current_owner_user_id === user.id
          ) {
            return 'À compléter';
          }
          return 'En cours';
        case 'Clôturée':
          return 'Clôturée';
        default:
          return 'En cours';
      }
    }
    if (user?.roles.includes(UserRoles.SVI)) {
      switch (currentStepLabel) {
        case 'Inspection par le SVI':
          return 'À compléter';
        case 'Clôturée':
          return 'Clôturée';
        default:
          return 'En cours';
      }
    }

    // now we are in the COLLECTEUR_PRO or ETG
    switch (currentStepLabel) {
      case 'Fiche envoyée, pas encore traitée':
      case 'Réception par un établissement de traitement':
      case 'Transport':
      case 'Transport vers un établissement de traitement':
      case 'Transport vers un autre établissement de traitement': {
        if (user?.roles.includes(UserRoles.COLLECTEUR_PRO)) {
          if (currentStepLabel === 'Réception par un établissement de traitement') {
            return 'En cours';
          }
          if (
            currentStepLabel !== 'Fiche envoyée, pas encore traitée' &&
            !currentStepLabel.includes('Transport')
          ) {
            return 'En cours';
          }
        }
        // Check per-carcasse next_owner_entity_id (multi-recipient dispatch)
        if (
          carcasses?.some(
            (c) => c.next_owner_entity_id && entitiesIdsWorkingDirectlyFor.includes(c.next_owner_entity_id)
          )
        ) {
          return 'À compléter';
        }
        // Fallback FEI-level
        if (fei.fei_next_owner_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_entity_id)) {
            return 'À compléter';
          }
          return 'En cours';
        }
        if (currentTransmission.current_owner_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(currentTransmission.current_owner_entity_id)) {
            return 'À compléter';
          }
        }
        return 'En cours';
      }
      case 'Clôturée':
        return 'Clôturée';
      case 'Examen initial':
      case 'Validation par le premier détenteur':
      case 'Inspection par le SVI':
      default:
        return 'En cours';
    }
  })();

  const currentStepLabelForEtg: FeiStepForEtg = (() => {
    if (currentStepLabel === 'Clôturée') {
      return "Prise en charge par le service vétérinaire d'inspection";
    }
    if (currentStepLabel === 'Inspection par le SVI') {
      return 'Fiche envoyée, pas encore prise en charge';
    }
    if (currentStepLabel === 'Réception par un établissement de traitement') {
      return "Prise en charge par l'atelier";
    }
    if (
      currentStepLabel === 'Transport' ||
      currentStepLabel === 'Transport vers un établissement de traitement' ||
      currentStepLabel === 'Transport vers un autre établissement de traitement'
    ) {
      return 'Prise en charge par le transporteur';
    }
    return 'Fiche reçue, pas encore prise en charge';
  })();

  const currentStepLabelForChasseur: FeiStepForChasseur = (() => {
    if (currentStepLabel === 'Clôturée') {
      return 'Carcasses traitées';
    }
    if (currentStepLabel === 'Examen initial') {
      return 'Information manquante';
    }
    if (currentStepLabel === 'Validation par le premier détenteur') {
      return 'Validation par le premier détenteur';
    }
    if (currentStepLabel === 'Fiche envoyée, pas encore traitée') {
      return 'Fiche envoyée, pas encore prise en charge';
    }
    if (
      currentStepLabel === 'Transport' ||
      currentStepLabel === 'Transport vers un établissement de traitement' ||
      currentStepLabel === 'Transport vers un autre établissement de traitement'
    ) {
      const destinataire = currentTransmission.next_owner_entity_name_cache;
      return destinataire
        ? `Prise en charge par le transporteur ${destinataire}`
        : 'Prise en charge par le transporteur';
    }
    if (
      currentStepLabel === 'Inspection par le SVI' ||
      currentStepLabel === 'Réception par un établissement de traitement' ||
      currentStepLabel === 'En cours'
    ) {
      return 'Traitement des carcasses';
    }
    return currentStepLabel;
  })();

  const currentStepLabelShort = (() => {
    if (currentTransmission.next_owner_sous_traite_by_entity_id) {
      if (entitiesIdsWorkingDirectlyFor.includes(currentTransmission.next_owner_sous_traite_by_entity_id)) {
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
    switch (currentStepLabel) {
      case 'Transport':
        return 'Transporté';
      default:
        return '';
    }
  })();

  return {
    currentStep: currentStepIndex + 1,
    currentStepLabel,
    currentStepLabelForEtg,
    currentStepLabelForChasseur,
    currentStepLabelShort,
    nextStepLabel,
    simpleStatus,
    steps,
  };
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
