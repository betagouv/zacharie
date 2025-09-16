import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { ApiKeyScope, Prisma } from '@prisma/client';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import type { AdminApiKeyResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import Checkbox from '@codegouvfr/react-dsfr/Checkbox';

export default function AdminNewApiKey() {
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
        const scopes = formData.getAll('scopes');
        const description = formData.get(Prisma.ApiKeyScalarFieldEnum.description);
        const name = formData.get(Prisma.ApiKeyScalarFieldEnum.name);
        if (!name) {
          alert('Le nom est requis');
          setIsLoading(false);
          return;
        }
        if (!scopes.length) {
          alert('Les permissions sont requises');
          setIsLoading(false);
          return;
        }
        API.post({
          path: 'admin/api-key/nouvelle',
          body: {
            scopes,
            description,
            name,
          },
        })
          .then((res) => res as AdminApiKeyResponse)
          .then((res) => {
            if (res.ok && res.data) {
              navigate(`/app/tableau-de-bord/admin/api-key/${res.data.apiKey.id}`);
            } else {
              setIsLoading(false);
            }
          });
      }}
    >
      <title>
        Nouvelle clé API | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle Clé API</h1>
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <Input
                label="Nom *"
                hintText="Le nom du tiers demandeur"
                nativeInputProps={{
                  id: Prisma.ApiKeyScalarFieldEnum.name,
                  name: Prisma.ApiKeyScalarFieldEnum.name,
                  required: true,
                  autoComplete: 'off',
                }}
              />
              <Input
                label="Description"
                hintText="Ce que va faire le tiers demandeur avec la clé API"
                nativeInputProps={{
                  id: Prisma.ApiKeyScalarFieldEnum.description,
                  name: Prisma.ApiKeyScalarFieldEnum.description,
                  required: false,
                  autoComplete: 'off',
                }}
              />
              <Checkbox
                hintText="Une clé api peut permettre d'accéder aux fiches et/ou aux carcasses. Les entités ou carcasses particulières seront sélectionnées dans la partie suivante."
                legend="Permissions"
                disabled={false}
                options={[
                  {
                    label: "Fiches au nom d'un utilisateur",
                    nativeInputProps: {
                      name: Prisma.ApiKeyScalarFieldEnum.scopes,
                      value: ApiKeyScope.FEI_READ_FOR_USER,
                    },
                  },
                  {
                    label: "Fiches au nom d'une entité",
                    nativeInputProps: {
                      name: Prisma.ApiKeyScalarFieldEnum.scopes,
                      value: ApiKeyScope.FEI_READ_FOR_ENTITY,
                    },
                  },
                  {
                    label: "Carcasses au nom d'un utilisateur",
                    nativeInputProps: {
                      name: Prisma.ApiKeyScalarFieldEnum.scopes,
                      value: ApiKeyScope.CARCASSE_READ_FOR_USER,
                    },
                  },
                  {
                    label: "Carcasses au nom d'une entité",
                    nativeInputProps: {
                      name: Prisma.ApiKeyScalarFieldEnum.scopes,
                      value: ApiKeyScope.CARCASSE_READ_FOR_ENTITY,
                    },
                  },
                ]}
              />
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
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
