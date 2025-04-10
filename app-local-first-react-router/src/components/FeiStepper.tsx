import { useMemo } from 'react';
import { useParams } from 'react-router';
import { UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';

export default function FeiStepper() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const steps = useMemo(
    () => [
      UserRoles.EXAMINATEUR_INITIAL,
      UserRoles.PREMIER_DETENTEUR,
      ...intermediaires
        .filter((i) => i.fei_intermediaire_role !== UserRoles.ETG)
        .map((i) => i.fei_intermediaire_role),
      UserRoles.ETG,
      UserRoles.SVI,
    ],
    [intermediaires],
  );

  const currentStep = useMemo(() => {
    // find role equal to fei.fei_current_owner_role but in reverse order
    if (fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
      return steps.length - 2;
    } else if (fei.fei_next_owner_role) {
      return steps.findIndex((role) => role === fei.fei_next_owner_role) + 1;
    } else {
      return steps.findIndex((role) => role === fei.fei_current_owner_role) + 1;
    }
  }, [fei.fei_current_owner_role, fei.fei_next_owner_role, steps]);

  const currentStepLabel = useMemo(() => {
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
        return '';
    }
  }, [currentStep, steps, fei.fei_next_owner_role]);

  const nextStepLabel = useMemo(() => {
    switch (steps[currentStep]) {
      case UserRoles.EXAMINATEUR_INITIAL:
        return 'Examen initial';
      case UserRoles.PREMIER_DETENTEUR:
        return 'Validation par le premier détenteur';
      case UserRoles.COLLECTEUR_PRO:
        return "Transport vers l'établissement de traitement";
      case UserRoles.ETG:
        return "Transport vers ou réception par l'établissement de traitement";
      case UserRoles.SVI:
        return 'Inspection par le SVI';
      default:
        return '';
    }
  }, [currentStep, steps]);

  return (
    <div className="w-full px-4 md:px-0">
      <Stepper
        currentStep={currentStep}
        stepCount={steps.length}
        title={currentStepLabel}
        nextTitle={nextStepLabel}
      />
    </div>
  );
}
