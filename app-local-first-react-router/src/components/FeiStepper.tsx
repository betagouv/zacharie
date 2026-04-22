import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { useFeiSteps } from '@app/utils/fei-steps';
import { EntityRelationType } from '@prisma/client';
import { FeiStep } from '@app/types/fei-steps';

export default function FeiStepper() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  let { currentStep, currentStepLabel, nextStepLabel, steps } = useFeiSteps(fei!);
  const entities = useZustandStore((state) => state.entities);

  const currentOwnerEntity = entities[fei.fei_current_owner_entity_id!];
  if (currentOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
    if (currentStepLabel === 'Réception par un établissement de traitement') {
      currentStepLabel = 'Réception par mon établissement de traitement' as FeiStep;
    }
  }

  const nextOwnerEntity = entities[fei.fei_next_owner_entity_id!];
  if (nextOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
    if (currentStepLabel === 'Transport vers un établissement de traitement') {
      currentStepLabel = 'Transport vers mon établissement de traitement' as FeiStep;
    }
    if (nextStepLabel === 'Réception par un établissement de traitement') {
      nextStepLabel = 'Réception par mon établissement de traitement' as FeiStep;
    }
  }

  return (
    <div className="w-full px-4 md:px-0">
      <Stepper
        key={currentStep}
        currentStep={currentStep}
        stepCount={steps.length}
        title={currentStepLabel}
        nextTitle={nextStepLabel}
      />
    </div>
  );
}
