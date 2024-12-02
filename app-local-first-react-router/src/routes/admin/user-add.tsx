import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma } from '@prisma/client';
import RolesCheckBoxes from '@app/components/RolesCheckboxes';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import type { AdminUserDataResponse } from '@api/src/types/responses';

export default function AdminNewUser() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  return (
    <form
      className="fr-container fr-container--fluid fr-my-md-14v"
      method="POST"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsLoading(true);
        const formData = new FormData(event.target as HTMLFormElement);
        const roles = formData.getAll('roles');
        const email = formData.get(Prisma.UserScalarFieldEnum.email);
        fetch(`${import.meta.env.VITE_API_URL}/admin/user/nouveau`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email,
            roles,
          }),
          headers: new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        })
          .then((res) => res.json())
          .then((res) => res as AdminUserDataResponse)
          .then((res) => {
            if (res.ok && res.data) {
              navigate(`/app/tableau-de-bord/admin/user/${res.data.user.id}`);
            } else {
              setIsLoading(false);
            }
          });
      }}
    >
      <title>Nouvel utilisateur | Admin | Zacharie | Ministère de l'Agriculture</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvel Utilisateur</h1>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <div className="fr-fieldset__element">
                <Input
                  label="Email"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.email,
                    name: Prisma.UserScalarFieldEnum.email,
                    required: true,
                    autoComplete: 'off',
                  }}
                />
              </div>
              <RolesCheckBoxes withAdmin legend="Sélectionnez tous les rôles du nouvel utilisateur" />
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    // children: navigation.state === 'idle' ? 'Créer' : 'Création en cours...',
                    children: isLoading ? 'Création en cours...' : 'Créer',
                    disabled: isLoading,
                    type: 'submit',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
