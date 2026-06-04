import { Alert } from '@codegouvfr/react-dsfr/Alert';

// ----------------------------------------------------------------------------
// Compte chasseur en attente de validation
// Tant que l'admin n'a pas activé le compte (user.activated === false), le
// backend rejette /sync. Le front masque donc les boutons de création et
// désactive ceux de transmission ; ce bandeau explique pourquoi.
// ----------------------------------------------------------------------------
export function CompteEnAttenteValidationAlert({ className = '' }: { className?: string }) {
  return (
    <Alert
      severity="info"
      className={`bg-white ${className}`}
      title="Compte en attente de validation"
      description="Vous pourrez créer et transmettre des fiches dès que votre compte sera validé. Nous vous enverrons un mail dès qu’il sera activé."
    />
  );
}
