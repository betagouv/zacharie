import { FeiDone } from '@api/src/types/fei';
import { FeiStep } from '@app/types/fei-steps';
import useZustandStore from '@app/zustand/store';
import { UserRoles } from '@prisma/client';
import { useMemo } from 'react';

export function useFeiSteps(fei: FeiDone) {
  const state = useZustandStore((state) => state);
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const steps = useMemo(
    () => [
      UserRoles.EXAMINATEUR_INITIAL,
      UserRoles.PREMIER_DETENTEUR,
      ...(intermediaires || [])
        .filter((i) => i.fei_intermediaire_role !== UserRoles.ETG)
        .map((i) => i.fei_intermediaire_role),
      UserRoles.ETG,
      UserRoles.SVI,
    ],
    [intermediaires],
  );

  const currentStep: number = useMemo(() => {
    // find role equal to fei.fei_current_owner_role but in reverse order
    if (fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
      return steps.length - 2;
    } else if (fei.fei_next_owner_role) {
      return steps.findIndex((role) => role === fei.fei_next_owner_role) + 1;
    } else {
      return steps.findIndex((role) => role === fei.fei_current_owner_role) + 1;
    }
  }, [fei.fei_current_owner_role, fei.fei_next_owner_role, steps]);

  const currentStepLabel: FeiStep = useMemo(() => {
    if (fei.automatic_closed_at || fei.svi_signed_at) {
      return 'Clôturée';
    }
    switch (steps[currentStep - 1]) {
      case UserRoles.EXAMINATEUR_INITIAL:
        return 'Examen initial';
      case UserRoles.PREMIER_DETENTEUR:
        return 'Validation par le premier détenteur';
      case UserRoles.COLLECTEUR_PRO:
        return "Transport vers l'établissement de traitement";
      case UserRoles.ETG: {
        if (fei.fei_next_owner_role === UserRoles.ETG) {
          return 'Fiche envoyée, pas encore traitée';
        } else {
          return "Réception par l'établissement de traitement";
        }
      }
      case UserRoles.SVI:
        return 'Inspection par le SVI';
      default:
        return 'Clôturée';
    }
  }, [currentStep, steps, fei.fei_next_owner_role, fei.automatic_closed_at, fei.svi_signed_at]);

  const nextStepLabel = useMemo(() => {
    switch (currentStepLabel) {
      case 'Examen initial':
        return 'Validation par le premier détenteur';
      case 'Validation par le premier détenteur':
        return "Transport vers l'établissement de traitement";
      case 'Fiche envoyée, pas encore traitée':
      case "Transport vers l'établissement de traitement":
        return "Transport vers / réception par l'établissement de traitement";
        return "Réception par l'établissement de traitement";
      case "Réception par l'établissement de traitement":
        return '';
      // return 'Inspection par le SVI';
      case 'Inspection par le SVI':
      default:
    }
  }, [currentStepLabel]);

  return {
    currentStep,
    currentStepLabel,
    nextStepLabel,
    steps,
  };
}
