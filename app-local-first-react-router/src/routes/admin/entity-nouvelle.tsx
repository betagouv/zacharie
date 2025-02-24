import { useNavigate } from 'react-router';
import { useState } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, EntityTypes } from '@prisma/client';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import type { AdminNewEntityResponse } from '@api/src/types/responses';

export default function AdminNouvelleEntite() {
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
        fetch(`${import.meta.env.VITE_API_URL}/admin/entity/nouvelle`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify(Object.fromEntries(formData)),
          headers: new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        })
          .then((res) => res.json())
          .then((res) => res as AdminNewEntityResponse)
          .then((res) => {
            if (res.ok) {
              navigate(`/app/tableau-de-bord/admin/entity/${res.data.entity.id}`);
            } else {
              setIsLoading(false);
            }
          });
      }}
    >
      <title>Nouvelle entité | Admin | Zacharie | Ministère de l'Agriculture</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle Entité</h1>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <Input
                label="Raison Sociale"
                nativeInputProps={{
                  id: Prisma.EntityScalarFieldEnum.raison_sociale,
                  name: Prisma.EntityScalarFieldEnum.raison_sociale,
                  placeholder: 'ETG de la Garenne',
                  required: true,
                  autoComplete: 'off',
                }}
              />
              <RadioButtons
                legend="Type d'entité"
                options={[
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.EntityScalarFieldEnum.type,
                      value: EntityTypes.PREMIER_DETENTEUR,
                    },
                    label: 'Premier détenteur (association de chasse, repas associatif, etc.)',
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.EntityScalarFieldEnum.type,
                      value: EntityTypes.CCG,
                    },
                    label: getUserRoleLabel(EntityTypes.CCG),
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.EntityScalarFieldEnum.type,
                      value: EntityTypes.COLLECTEUR_PRO,
                    },
                    label: getUserRoleLabel(EntityTypes.COLLECTEUR_PRO),
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.EntityScalarFieldEnum.type,
                      value: EntityTypes.ETG,
                    },
                    label: getUserRoleLabel(EntityTypes.ETG),
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.EntityScalarFieldEnum.type,
                      value: EntityTypes.SVI,
                    },
                    label: getUserRoleLabel(EntityTypes.SVI),
                  },
                ]}
              />
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
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
