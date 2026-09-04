import { Navigate, useSearchParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { ProConnectButton } from '@codegouvfr/react-dsfr/ProConnectButton';
import RootDisplay from '@app/components/RootDisplay';
import API from '@app/services/api';
import useUser from '@app/zustand/user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';

const errorMessages: Record<string, string> = {
  email_mismatch:
    "L'email renvoyé par ProConnect ne correspond pas à celui de votre compte Zacharie. Connectez-vous à ProConnect avec le même email.",
  proconnect_failed: 'La connexion ProConnect a échoué. Veuillez réessayer.',
  session_expired: 'La connexion ProConnect a expiré. Veuillez réessayer.',
  not_configured: "ProConnect n'est pas configuré sur ce serveur.",
};

// Étape obligatoire pour les admins Zacharie : le backend refuse /admin sans ProConnect récent.
// Le bouton est un lien vers l'API, qui redirige vers ProConnect puis revient sur `redirect`.
export default function ProConnect() {
  const user = useUser((state) => state.user);
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/app/admin';

  if (!user) {
    return <Navigate to="/app/connexion" />;
  }
  if (!user.isZacharieAdmin) {
    return <Navigate to={getUserOnboardingRoute(user)} />;
  }

  return (
    <RootDisplay
      id="proconnect"
      mainLink={getUserOnboardingRoute(user)}
    >
      <main
        role="main"
        id="content"
      >
        <title>ProConnect | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
              <div className="fr-background-alt--blue-france p-4 md:p-8">
                <h2 className="fr-h3">Connexion ProConnect requise</h2>
                <p>
                  Votre compte <strong>{user.email}</strong> est administrateur de Zacharie. Pour accéder à
                  l'administration, vous devez vous identifier avec ProConnect en utilisant ce même email.
                </p>
                {error && (
                  <Alert
                    severity="error"
                    small
                    description={errorMessages[error] ?? errorMessages.proconnect_failed}
                    className="fr-mb-4w"
                  />
                )}
                <div className="my-4 block">
                  <ProConnectButton url={API.getUrl('user/proconnect/start', { redirect })} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </RootDisplay>
  );
}
