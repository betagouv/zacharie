import { Alert } from '@codegouvfr/react-dsfr/Alert';

type CompteEnAttenteVariant = 'examinateur' | 'chasseur';

const descriptionByVariant: Record<CompteEnAttenteVariant, string> = {
  examinateur:
    'Vous pouvez créer et préparer vos fiches, mais vous ne pourrez les transmettre qu’une fois votre compte validé. Nous vous enverrons un mail dès qu’il sera activé.',
  chasseur:
    'Vous pourrez consulter et recevoir des fiches une fois votre compte validé. Nous vous enverrons un mail dès qu’il sera activé.',
};

export function CompteEnAttenteValidationAlert({
  variant = 'examinateur',
  className = '',
}: {
  variant?: CompteEnAttenteVariant;
  className?: string;
}) {
  return (
    <Alert
      severity="info"
      className={`bg-white ${className}`}
      title="Compte en attente de validation"
      description={descriptionByVariant[variant]}
    />
  );
}
