import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { useFeiSteps } from '@app/utils/fei-steps';

export default function FeiStepper() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];

  const { currentStep, currentStepLabel, nextStepLabel, steps } = useFeiSteps(fei!);

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
