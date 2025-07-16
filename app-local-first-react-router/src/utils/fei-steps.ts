import { capture } from '@app/services/sentry';
import type { FeiDone } from '@api/src/types/fei';
import type { FeiStep, FeiStepSimpleStatus } from '@app/types/fei-steps';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { Entity, EntityTypes, User, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';

type IntermediaireStep = {
  id: string | null;
  role: EntityTypes | UserRoles;
  nextRole: EntityTypes | UserRoles | null;
};

type UseFeiStepsReturn = {
  currentStep: number;
  currentStepLabel: FeiStep;
  nextStepLabel: FeiStep;
  simpleStatus: FeiStepSimpleStatus;
  steps: Array<IntermediaireStep>;
};

export function useFeiSteps(fei: FeiDone): UseFeiStepsReturn {
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const user = useUser((state) => state.user);
  const entitiesIdsWorkingDirectlyFor = useZustandStore((state) => state.entitiesIdsWorkingDirectlyFor);
  const entitiesIdsWorkingDirectlyAndIndirectlyFor = useZustandStore(
    (state) => state.entitiesIdsWorkingDirectlyAndIndirectlyFor,
  );

  const memoizedComputeFeiSteps = useMemo(() => {
    return computeFeiSteps({
      fei,
      intermediaires,
      entitiesIdsWorkingDirectlyFor,
      entitiesIdsWorkingDirectlyAndIndirectlyFor,
      user,
    });
  }, [fei, intermediaires, entitiesIdsWorkingDirectlyFor, entitiesIdsWorkingDirectlyAndIndirectlyFor, user]);
  return memoizedComputeFeiSteps;
}

interface ComputeFeiStepsParams {
  fei: FeiDone;
  intermediaires: Array<FeiIntermediaire>;
  entitiesIdsWorkingDirectlyFor: Array<Entity['id']>;
  entitiesIdsWorkingDirectlyAndIndirectlyFor: Array<Entity['id']>;
  user: User | null;
}

export function computeFeiSteps({
  fei,
  intermediaires,
  entitiesIdsWorkingDirectlyFor,
  entitiesIdsWorkingDirectlyAndIndirectlyFor,
  user,
}: ComputeFeiStepsParams): UseFeiStepsReturn {
  const steps: Array<IntermediaireStep> = (() => {
    const _steps: Array<IntermediaireStep> = [
      {
        id: fei.examinateur_initial_user_id,
        role: UserRoles.EXAMINATEUR_INITIAL,
        nextRole: UserRoles.PREMIER_DETENTEUR,
      },
      {
        id: fei.premier_detenteur_entity_id || fei.premier_detenteur_user_id,
        role: UserRoles.PREMIER_DETENTEUR,
        nextRole: fei.premier_detenteur_prochain_detenteur_type_cache,
      },
    ];
    for (const i of intermediaires) {
      _steps.push({
        id: i.id,
        role: i.intermediaire_role as EntityTypes | UserRoles,
        nextRole: i.intermediaire_prochain_detenteur_type_cache,
      });
    }
    if (fei.intermediaire_closed_at) return _steps;
    const lastStepIsEtgToSvi =
      _steps[_steps.length - 1]?.role === UserRoles.ETG &&
      _steps[_steps.length - 1]?.nextRole === UserRoles.SVI;
    if (!lastStepIsEtgToSvi) {
      // on simplifie ici : pour montrer à l'utilisateur qu'on anticipe une étape ETG puis SVI
      // mais peut-être que ça va changer, avec les circuits longs, les circuits courts...
      _steps.push({
        id: null,
        role: UserRoles.ETG,
        nextRole: UserRoles.SVI,
      });
    }
    _steps.push({
      id: null,
      role: UserRoles.SVI,
      nextRole: null,
    });
    return _steps;
  })();

  const currentStepIndex: number = (() => {
    // find role equal to fei.fei_current_owner_role but in reverse order
    if (fei.svi_assigned_at) return steps.length - 1; // step is SVI
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) return 0;
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) return 1;
    if (fei.intermediaire_closed_at) return steps.length - 1; // fei is closed
    const etgStep = steps[steps.length - 2];
    if (etgStep.id) return steps.length - 2; // etg is selected
    return steps.length - 3; // etg is not selected
  })();

  const currentStepLabel: FeiStep = (() => {
    if (fei.automatic_closed_at || fei.svi_closed_at || fei.intermediaire_closed_at) {
      return 'Clôturée';
    }
    if (fei.svi_assigned_at) return 'Inspection par le SVI';
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) return 'Examen initial';
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      if (!fei.fei_next_owner_role) {
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
    if (currentStep.role === UserRoles.COLLECTEUR_PRO) {
      if (currentStep.nextRole === EntityTypes.ETG) {
        return 'Transport vers un établissement de traitement';
      } else if (currentStep.nextRole === EntityTypes.COLLECTEUR_PRO) {
        return 'Transport';
      }
      // pas de nextRole donc on ne sait rien d'autre que : c'est un transport
      return 'Transport';
    }
    if (currentStep.role === UserRoles.ETG) {
      if (currentStep.nextRole === EntityTypes.ETG || currentStep.nextRole === EntityTypes.COLLECTEUR_PRO) {
        return 'Transport vers un autre établissement de traitement';
      }
      return 'Réception par un établissement de traitement';
    }
    capture('bug dans currentStepLabel', { extra: { fei, steps } });
    return 'En cours';
  })();

  const nextStepLabel: FeiStep = (() => {
    switch (currentStepLabel) {
      case 'Examen initial':
        return 'Validation par le premier détenteur';
      case 'Validation par le premier détenteur':
        return 'Transport vers un établissement de traitement';
      case 'Fiche envoyée, pas encore traitée':
      case 'Transport vers un établissement de traitement':
      case 'Transport vers un autre établissement de traitement':
      case 'Transport':
        return 'Transport vers / réception par un établissement de traitement';
      case 'Réception par un établissement de traitement':
        // return '';
        return 'Inspection par le SVI';
      case 'Inspection par le SVI':
      default:
        return 'Clôturée';
    }
  })();

  const simpleStatus: FeiStepSimpleStatus = (() => {
    if (
      user?.roles.includes(UserRoles.PREMIER_DETENTEUR) ||
      user?.roles.includes(UserRoles.EXAMINATEUR_INITIAL)
    ) {
      switch (currentStepLabel) {
        case 'Examen initial':
        case 'Validation par le premier détenteur':
          return 'À compléter';
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
          if (!user?.roles.includes(UserRoles.ETG)) {
            if (currentStepLabel === 'Réception par un établissement de traitement') {
              return 'En cours';
            }
          }
          if (currentStepLabel !== 'Fiche envoyée, pas encore traitée' && currentStepLabel !== 'Transport') {
            return 'En cours';
          }
        }
        if (fei.fei_next_owner_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_entity_id)) {
            return 'À compléter';
          }
          if (entitiesIdsWorkingDirectlyAndIndirectlyFor.includes(fei.fei_next_owner_entity_id)) {
            return 'À compléter';
          }
          return 'En cours';
        }
        if (fei.fei_current_owner_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_current_owner_entity_id)) {
            return 'À compléter';
          }
          if (entitiesIdsWorkingDirectlyAndIndirectlyFor.includes(fei.fei_current_owner_entity_id)) {
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

  return {
    currentStep: currentStepIndex + 1,
    currentStepLabel,
    nextStepLabel,
    simpleStatus,
    steps,
  };
}
