import { FeiDone } from '@api/src/types/fei';
import { FeiStep, FeiStepSimpleStatus } from '@app/types/fei-steps';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { EntityTypes, UserRoles } from '@prisma/client';
import { useMemo } from 'react';

type IntermediaireStep = {
  id: string | null;
  role: EntityTypes;
  nextRole: EntityTypes | null;
};

export function useFeiSteps(fei: FeiDone) {
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const user = useUser((state) => state.user);
  const entities = useZustandStore((state) => state.entities);

  const steps = useMemo(() => {
    const steps: Array<unknown> = [
      fei.examinateur_initial_user_id,
      fei.premier_detenteur_entity_id || fei.premier_detenteur_user_id,
    ];

    let alreadyEtg = false;
    for (const i of intermediaires) {
      if (i.intermediaire_role === UserRoles.ETG) {
        alreadyEtg = true;
      }
      steps.push({
        id: i.id,
        role: i.intermediaire_role,
        nextRole: i.intermediaire_prochain_detenteur_id_cache
          ? entities[i.intermediaire_prochain_detenteur_id_cache]?.type
          : null,
      } as IntermediaireStep);
    }
    if (!alreadyEtg) {
      // on simplifie ici : pour montrer à l'utilisateur qu'on anticipe une étape ETG puis SVI
      // mais peut-être que ça va changer, avec les circuits longs, les circuits courts...
      steps.push({
        id: null,
        role: UserRoles.ETG,
        nextRole: null,
      });
    }
    steps.push(fei.svi_assigned_at);
    return steps;
  }, [
    fei.examinateur_initial_user_id,
    fei.premier_detenteur_entity_id,
    fei.premier_detenteur_user_id,
    fei.svi_assigned_at,
    intermediaires,
    entities,
  ]);

  console.log(steps);

  const currentStep: number = useMemo(() => {
    // find role equal to fei.fei_current_owner_role but in reverse order
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) return 1;
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) return 2;
    if (fei.svi_assigned_at) return steps.length;
    const etgStep = steps[steps.length - 2] as IntermediaireStep;
    if (etgStep.id) {
      return steps.length - 1;
    }
    return steps.length - 2;
  }, [fei.fei_current_owner_role, fei.svi_assigned_at, steps]);

  const currentStepLabel: FeiStep = useMemo(() => {
    if (fei.automatic_closed_at || fei.svi_closed_at || fei.intermediaire_closed_at) {
      return 'Clôturée';
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) return 'Examen initial';
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      return 'Validation par le premier détenteur';
    }
    if (fei.svi_assigned_at) return 'Inspection par le SVI';

    const avantDernierStep = steps[steps.length - 2] as IntermediaireStep; // c'est toujours l'étape ETG, qu'il soit sélectionné ou pas encore
    if (avantDernierStep.id) {
      console.log('ETG sélectionné', avantDernierStep);
      // l'ETG a été sélectionné, mais a-t-il commencé à traiter la fiche ?
      if (fei.fei_next_owner_role === UserRoles.ETG) {
        return 'Fiche envoyée, pas encore traitée';
      } else {
        return 'Réception par un établissement de traitement';
      }
    } else {
      // pas encore d'ETG, on regarde l'étape précédente
      // pour simplifier :
      const avantAvantDernierStep = steps[steps.length - 3] as IntermediaireStep;
      if (avantAvantDernierStep.role === UserRoles.COLLECTEUR_PRO) {
        if (avantAvantDernierStep.nextRole === EntityTypes.ETG) {
          return 'Transport vers un établissement de traitement';
        }
        if (avantAvantDernierStep.nextRole === EntityTypes.COLLECTEUR_PRO) {
          return 'Transport';
        }
        return 'Transport';
      }
      if (avantAvantDernierStep.role === UserRoles.ETG) {
        if (!avantAvantDernierStep.nextRole) {
          return 'Réception par un établissement de traitement';
        }
        return 'Transport vers un autre établissement de traitement';
      }
      return 'Clôturée';
    }
  }, [
    fei.automatic_closed_at,
    fei.svi_closed_at,
    fei.intermediaire_closed_at,
    fei.fei_current_owner_role,
    fei.svi_assigned_at,
    fei.fei_next_owner_role,
    steps,
  ]);

  const nextStepLabel: FeiStep = useMemo(() => {
    switch (currentStepLabel) {
      case 'Examen initial':
        return 'Validation par le premier détenteur';
      case 'Validation par le premier détenteur':
        return 'Transport vers un établissement de traitement';
      case 'Fiche envoyée, pas encore traitée':
      case 'Transport vers un établissement de traitement':
      case 'Transport':
        // return "Réception par l'établissement de traitement";
        return 'Transport vers / réception par un établissement de traitement';
      case 'Réception par un établissement de traitement':
        // return '';
        return 'Inspection par le SVI';
      case 'Inspection par le SVI':
      default:
        return 'Clôturée';
    }
  }, [currentStepLabel]);

  const simpleStatus: FeiStepSimpleStatus = useMemo(() => {
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
    if (user?.roles.includes(UserRoles.COLLECTEUR_PRO)) {
      switch (currentStepLabel) {
        case 'Fiche envoyée, pas encore traitée':
        case 'Transport':
          return 'À compléter';
        case 'Clôturée':
          return 'Clôturée';
        default:
          return 'En cours';
      }
    }
    // now we are in the ETG or COLLECTEUR_PRO role
    switch (currentStepLabel) {
      case 'Fiche envoyée, pas encore traitée':
      case 'Réception par un établissement de traitement':
        return 'À compléter';
      case 'Clôturée':
        return 'Clôturée';
      default:
        return 'En cours';
    }
  }, [currentStepLabel, user?.roles]);

  return {
    currentStep,
    currentStepLabel,
    nextStepLabel,
    simpleStatus,
    steps,
  };
}
