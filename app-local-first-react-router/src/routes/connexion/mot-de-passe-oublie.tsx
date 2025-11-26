import { Input } from '@codegouvfr/react-dsfr/Input';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { type UserConnexionResponse } from '@api/src/types/responses';
import { useEffect, useState } from 'react';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { capture } from '@app/services/sentry';
import API from '@app/services/api';
import { clearCache } from '@app/services/indexed-db';

export default function MotDePasseOublie() {
  const [searchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userResponse, setUserResponse] = useState<UserConnexionResponse | null>(null);

  const communication = searchParams.get('communication');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget.closest('form') as HTMLFormElement;
    const formData = new FormData(form);

    const response = await API.post({
      path: 'user/forget-password',
      body: {
        email: formData.get('email-utilisateur'),
        username: formData.get('name'),
      },
    })
      .then((response) => response as UserConnexionResponse)
      .catch((error) => {
        capture(error, { extra: { formData: Object.fromEntries(formData) } });
        return {
          ok: false,
          data: { user: null },
          message: 'Service momentanément indisponible, veuillez réessayer ultérieurement',
          error: 'Erreur inconnue',
        };
      });
    setIsLoading(false);
    if (response.message) {
      window.scrollTo(0, 0);
    }
    // forget-password ne retourne pas d'utilisateur connecté, juste un message de succès
    setUserResponse(response);
  };

  // Helper function to safely access error message
  const getErrorMessage = (field: string): string => {
    if (typeof userResponse === 'object' && userResponse !== null && 'error' in userResponse) {
      if (!userResponse.error) {
        return '';
      }
      return userResponse.error.includes?.(field) ? userResponse.error! : '';
    }
    return '';
  };

  useEffect(() => {
    clearCache('connexion').then(() =>
      refreshUser('connexion').then((user) => {
        console.log('init user', user);
        setInitialLoading(false);
      }),
    );
  }, []);

  if (initialLoading) {
    return <Chargement />;
  }

  return (
    <main role="main" id="content">
      <title>
        Mot de passe oublié | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
            {communication && <CallOut>{decodeURIComponent(communication)}</CallOut>}
            {userResponse?.message && <CallOut>{userResponse?.message}</CallOut>}
            {userResponse?.error && !userResponse?.message && (
              <CallOut title="Erreur">{userResponse.error}</CallOut>
            )}
            <form
              onSubmit={handleSubmit}
              id="forget_password_form"
              method="POST"
              className="fr-background-alt--blue-france p-4 md:p-8"
            >
              <fieldset
                className="fr-fieldset"
                id="forget-password-fieldset"
                aria-labelledby="forget-password-fieldset-legend forget-password-fieldset-messages"
              >
                <legend className="fr-fieldset__legend" id="forget-password-fieldset-legend">
                  <h2 className="fr-h3">Mot de passe oublié</h2>
                </legend>
              </fieldset>
              <input type="text" name="name" className="hidden" />
              <Input
                hintText="Renseignez votre email ci-dessous. Vous recevrez un email avec un lien pour réinitialiser votre mot de passe."
                label="Mon email"
                state={getErrorMessage('email') ? 'error' : 'default'}
                stateRelatedMessage={getErrorMessage('email')}
                nativeInputProps={{
                  name: 'email-utilisateur',
                  type: 'email',
                  autoComplete: 'username',
                  placeholder: 'votre@email.com',
                  defaultValue: import.meta.env.VITE_TEST ? '' : (import.meta.env.VITE_EMAIL ?? ''),
                  required: true,
                }}
              />

              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left block">
                <li className="flex w-auto justify-start">
                  <Button type="submit" disabled={isLoading}>
                    Envoyer un email de réinitialisation
                  </Button>
                </li>
              </ul>
              <hr />
              <p className="text-xs">
                Vous vous souvenez de votre mot de passe ?{' '}
                <Link to="/app/connexion">Cliquez ici pour vous connecter</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
