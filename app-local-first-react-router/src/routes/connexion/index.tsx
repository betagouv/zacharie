import { Input } from '@codegouvfr/react-dsfr/Input';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { type User } from '@prisma/client';
import { type UserConnexionResponse } from '@api/src/types/responses';
import { useEffect, useState } from 'react';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { capture } from '@app/services/sentry';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';
import { clearCache } from '@app/services/indexed-db';

export default function Connexion() {
  const [searchParams] = useSearchParams();
  const user = useUser((state) => state.user);
  const [initialLoading, setInitialLoading] = useState(!!user);
  const [isLoading, setIsLoading] = useState(false);
  const [userResponse, setUserResponse] = useState<UserConnexionResponse | null>(null);
  // we don't user   useMostFreshUser() here on purpose to avoid infinite loop
  const navigate = useNavigate();

  const redirect = searchParams.get('redirect');
  const communication = searchParams.get('communication');

  const handleRedirect = (user: User) => {
    if (user) {
      const redirectPath = redirect || getUserOnboardingRoute(user) || '/app/tableau-de-bord';
      navigate(redirectPath);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget.closest('form') as HTMLFormElement;
    const formData = new FormData(form);
    const response = await API.post({
      path: 'user/login',
      body: {
        email: formData.get('email-utilisateur'),
        username: formData.get('name'),
        passwordUser: formData.get('password-utilisateur'),
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
      useZustandStore.setState((state) => ({ users: { ...state.users, [user.id]: user } }));
      handleRedirect(user);
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

  useEffect(() => {
    clearCache('connexion').then(() =>
      refreshUser('connexion').then((user) => {
        console.log('init user', user);
        if (!user) {
          setInitialLoading(false);
        } else {
          handleRedirect(user);
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialLoading) {
    return <Chargement />;
  }

  return (
    <main role="main" id="content">
      <title>Connexion | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
            {communication && <CallOut>{decodeURIComponent(communication)}</CallOut>}
            {userResponse?.message && <CallOut>{userResponse?.message}</CallOut>}
            <form
              onSubmit={handleSubmit}
              id="login_form"
              method="POST"
              className="fr-background-alt--blue-france p-4 md:p-8"
            >
              <fieldset
                className="fr-fieldset"
                id="login-1760-fieldset"
                aria-labelledby="login-1760-fieldset-legend login-1760-fieldset-messages"
              >
                <legend className="fr-fieldset__legend" id="login-1760-fieldset-legend">
                  <h2 className="fr-h3">Me connecter</h2>
                </legend>
              </fieldset>
              <input type="text" name="name" className="hidden" />
              <Input
                hintText="Renseignez votre email ci-dessous"
                label="Mon email"
                state={getErrorMessage('email') || getErrorMessage('mot de passe') ? 'error' : 'default'}
                stateRelatedMessage={getErrorMessage('email') || getErrorMessage('mot de passe')}
                nativeInputProps={{
                  name: 'email-utilisateur',
                  type: 'email',
                  autoComplete: 'username',
                  placeholder: 'votre@email.com',
                  defaultValue: import.meta.env.VITE_TEST ? '' : (import.meta.env.VITE_EMAIL ?? ''),
                }}
              />
              <PasswordInput
                hintText="Veuillez entrer votre mot de passe"
                label="Mon mot de passe"
                nativeInputProps={{
                  name: 'password-utilisateur',
                  minLength: 12,
                  autoComplete: 'current-password',
                  placeholder: 'votre mot de passe',
                  defaultValue: import.meta.env.VITE_TEST ? '' : (import.meta.env.VITE_PASSWORD ?? ''),
                }}
              />

              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left block">
                <li className="flex w-auto justify-start">
                  <Button type="submit" disabled={isLoading}>
                    Me connecter
                  </Button>
                </li>
                <li className="flex w-auto justify-start">
                  <Link
                    to="/app/connexion/mot-de-passe-oublie"
                    className="w-full py-1 text-center text-xs! text-gray-500"
                  >
                    <span>
                      Mot de passe oublié ? <u className="inline">Cliquez ici</u>, vous recevrez un email avec
                      un lien pour le réinitialiser
                    </span>
                  </Link>
                </li>
              </ul>
              <hr />
              <p className="text-xs">
                Vous n'avez pas encore de compte ?{' '}
                <Link to="/app/connexion/creation-de-compte">Cliquez ici pour en créer un</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
