import useUser from '@app/zustand/user';
import { Alert } from '@codegouvfr/react-dsfr/Alert';

// ----------------------------------------------------------------------------
// Compte chasseur en attente de validation
// Tant que l'admin n'a pas activé le compte (user.activated === false), le
// chasseur peut préparer ses fiches mais pas les transmettre : le front
// désactive les boutons de transmission ; ce bandeau explique pourquoi.
// ----------------------------------------------------------------------------
export function CompteEnAttenteValidationAlert({ className = '' }: { className?: string }) {
  const me = useUser((state) => state.user);
  let description =
    'Vous pouvez créer et préparer vos fiches, mais vous ne pourrez les transmettre qu’une fois votre compte validé. Nous vous enverrons un mail dès qu’il sera activé.';
  if (!me?.numero_cfei) {
    description =
      'Vous ne pourrez transmettre vos fiches qu’une fois votre compte validé. Nous vous enverrons un mail dès qu’il sera activé.';
  }
  return (
    <Alert
      severity="info"
      className={`bg-white ${className}`}
      title="Compte en attente de validation"
      description={description}
    />
  );
}
