import { useEffect, useState } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import type { UserConnexionResponse } from '@api/src/types/responses';
import { capture } from '@app/services/sentry';
import API from '@app/services/api';

export default function ChangerMonMotDePasse() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = formData.get('new-password') as string;
    const newPasswordConfirmation = formData.get('new-password-confirmation') as string;
    setError(null);
    setSuccess(false);
    if (newPassword !== newPasswordConfirmation) {
      setError('Les deux mots de passe ne sont pas identiques');
      return;
    }
    setIsLoading(true);
    const response = await API.post({
      path: 'user/change-password',
      body: {
        currentPassword: formData.get('current-password'),
        newPassword,
      },
    })
      .then((response) => response as UserConnexionResponse)
      .catch((error) => {
        capture(error);
        return {
          ok: false,
          data: { user: null },
          message: '',
          error: 'Service momentanément indisponible, veuillez réessayer ultérieurement',
        } as UserConnexionResponse;
      });
    setIsLoading(false);
    if (response.ok) {
      form.reset();
      setSuccess(true);
    } else {
      setError(response.error || response.message || 'Une erreur est survenue');
    }
  };

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Changer de mot de passe | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Changer de mot de passe</h1>
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              <form
                id="change_password_form"
                method="POST"
                onSubmit={handleSubmit}
              >
                <PasswordInput
                  label="Mot de passe actuel"
                  nativeInputProps={{
                    name: 'current-password',
                    autoComplete: 'current-password',
                    required: true,
                  }}
                />
                <PasswordInput
                  label="Nouveau mot de passe"
                  hintText="Minimum 12 caractères"
                  nativeInputProps={{
                    name: 'new-password',
                    autoComplete: 'new-password',
                    minLength: 12,
                    required: true,
                  }}
                />
                <PasswordInput
                  label="Confirmer le nouveau mot de passe"
                  nativeInputProps={{
                    name: 'new-password-confirmation',
                    autoComplete: 'new-password',
                    minLength: 12,
                    required: true,
                  }}
                />
                {error && (
                  <Alert
                    className="my-4"
                    severity="error"
                    title="Erreur"
                    description={error}
                  />
                )}
                {success && (
                  <Alert
                    className="my-4"
                    severity="success"
                    title="Votre mot de passe a été modifié"
                    description="Vous utiliserez ce nouveau mot de passe à votre prochaine connexion"
                  />
                )}
                <ButtonsGroup
                  inlineLayoutWhen="always"
                  alignment="left"
                  buttons={[
                    {
                      children: 'Changer mon mot de passe',
                      nativeButtonProps: {
                        type: 'submit',
                        disabled: isLoading,
                      },
                    },
                  ]}
                />
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
