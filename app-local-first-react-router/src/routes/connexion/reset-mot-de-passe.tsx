import { Link, useSearchParams, useNavigate } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { type User } from '@prisma/client';
import { type UserConnexionResponse } from '@api/src/types/responses';
import { useState } from 'react';
import { capture } from '@app/services/sentry';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';

export default function ResetMotDePasse() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [userResponse, setUserResponse] = useState<UserConnexionResponse | null>(null);
  const navigate = useNavigate();

  const resetPasswordToken = searchParams.get('reset-password-token') || '';
  const redirect = searchParams.get('redirect');
  const communication = searchParams.get('communication');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget.closest('form') as HTMLFormElement;
    const formData = new FormData(form);

    if (!resetPasswordToken) {
      setUserResponse({
        ok: false,
        data: { user: null },
        message: '',
        error: 'Le token de réinitialisation est manquant. Veuillez utiliser le lien reçu par email.',
      });
      setIsLoading(false);
      return;
    }

    const response = await API.post({
      path: 'user/reset-password',
      body: {
        username: formData.get('name'),
        passwordUser: formData.get('password-utilisateur'),
        resetPasswordToken: resetPasswordToken,
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
    if (response.ok && response.data?.user?.id) {
      const user = response.data.user as User;
      useUser.setState({ user });
      useZustandStore.setState((state) => ({
        users: { ...state.users, [user.id]: user },
      }));
      const redirectPath = redirect || getUserOnboardingRoute(user) || '/app/tableau-de-bord';
      navigate(redirectPath);
    } else {
      useUser.setState({ user: null });
      setUserResponse(response);
    }
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

  if (!resetPasswordToken) {
    return (
      <main role="main" id="content">
        <title>
          Réinitialisation de mot de passe | Zacharie | Ministère de l'Agriculture et de la Souveraineté
          Alimentaire
        </title>
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
              <CallOut title="Token manquant">
                Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien de
                réinitialisation.
              </CallOut>
              <div className="mt-4">
                <Link to="/app/connexion/mot-de-passe-oublie">
                  <Button>Demander un nouveau lien de réinitialisation</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main role="main" id="content">
      <title>
        Réinitialisation de mot de passe | Zacharie | Ministère de l'Agriculture et de la Souveraineté
        Alimentaire
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
            {communication && <CallOut>{decodeURIComponent(communication)}</CallOut>}
            <CallOut>Vous pouvez maintenant définir votre nouveau mot de passe</CallOut>
            {userResponse?.message && <CallOut>{userResponse?.message}</CallOut>}
            {userResponse?.error && !userResponse?.message && (
              <CallOut title="Erreur">{userResponse.error}</CallOut>
            )}
            <form
              onSubmit={handleSubmit}
              id="reset_password_form"
              method="POST"
              className="fr-background-alt--blue-france p-4 md:p-8"
            >
              <fieldset
                className="fr-fieldset"
                id="reset-password-fieldset"
                aria-labelledby="reset-password-fieldset-legend reset-password-fieldset-messages"
              >
                <legend className="fr-fieldset__legend" id="reset-password-fieldset-legend">
                  <h2 className="fr-h3">Réinitialiser mon mot de passe</h2>
                </legend>
              </fieldset>
              <input type="text" name="name" className="hidden" />
              <PasswordInput
                hintText="Veuillez entrer votre nouveau mot de passe (minimum 12 caractères)"
                label="Mon nouveau mot de passe"
                messages={
                  getErrorMessage('mot de passe')
                    ? [{ message: getErrorMessage('mot de passe'), severity: 'error' }]
                    : undefined
                }
                nativeInputProps={{
                  name: 'password-utilisateur',
                  minLength: 12,
                  autoComplete: 'new-password',
                  placeholder: 'votre nouveau mot de passe',
                  defaultValue: import.meta.env.VITE_TEST ? '' : '',
                  required: true,
                }}
              />

              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left block">
                <li className="flex w-auto justify-start">
                  <Button type="submit" disabled={isLoading}>
                    Réinitialiser mon mot de passe
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
