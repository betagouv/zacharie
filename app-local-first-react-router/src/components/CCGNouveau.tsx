import { useState, useCallback } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { EntityTypes, EntityRelationType, Prisma, Entity, EntityAndUserRelations } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { UserEntityResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import useZustandStore from '@app/zustand/store';

interface CCGCreateResponse {
  ok: boolean;
  error: string;
  data: {
    createdEntity: Entity;
    createdEntityRelation: EntityAndUserRelations;
  };
}

interface CCGNouveauProps {
  onFinish: (entity: UserEntityResponse['data']['entity']) => void;
}

export default function CCGNouveau({ onFinish }: CCGNouveauProps) {
  const user = useUser((state) => state.user)!;
  const entities = useZustandStore((state) => state.entities);

  const [mode, setMode] = useState<'select' | 'quick' | 'full'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ccgPostalCode, setCCGPostalCode] = useState('');

  // Quick add by numero_ddecpp
  const handleQuickAdd = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setError('');

      const formData = new FormData(event.currentTarget);
      const response = await API.post({
        path: `/user/user-entity/${user.id}`,
        body: {
          _action: 'create',
          [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          [Prisma.EntityScalarFieldEnum.numero_ddecpp]: formData.get(
            Prisma.EntityScalarFieldEnum.numero_ddecpp,
          ),
          [Prisma.EntityScalarFieldEnum.type]: EntityTypes.CCG,
        },
      }).then((res) => res as UserEntityResponse);

      setIsSubmitting(false);
      if (response.ok && response.data.entity) {
        useZustandStore.setState({
          entities: {
            ...entities,
            [response.data.entity.id]: {
              ...response.data.entity,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              relationStatus: undefined,
            },
          },
        });
        onFinish(response.data.entity);
      }
      if (response.error) {
        setError(response.error);
      }
    },
    [user.id, entities, onFinish],
  );

  // Full pre-registration form
  const handleFullSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setError('');

      const formData = new FormData(event.currentTarget);
      const body: Partial<Entity> = Object.fromEntries(formData.entries());

      const response = await API.post({
        path: 'entite/ccg',
        body,
      }).then((res) => res as CCGCreateResponse);

      setIsSubmitting(false);
      if (response.ok && response.data?.createdEntity) {
        const newCCG = response.data.createdEntity;
        useZustandStore.setState({
          entities: {
            ...entities,
            [newCCG.id]: {
              ...newCCG,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              relationStatus: undefined,
            },
          },
        });
        onFinish(newCCG);
      } else {
        setError(response.error || 'Erreur lors de la création du CCG');
      }
    },
    [entities, onFinish],
  );

  return (
    <>
      <p className="mb-5 text-sm text-gray-500">
        * Les champs marqués d'un astérisque (*) sont obligatoires.
      </p>

      {mode === 'select' && (
        <RadioButtons
          legend="Votre chambre froide a-t-elle un numéro d'identification ?"
          hintText="Le numéro d'identification est de la forme 03-CCG-123 ou 03.564.345"
          orientation="vertical"
          options={[
            {
              nativeInputProps: {
                name: 'ccg_mode',
                onChange: () => setMode('quick'),
              },
              label: "Oui, ma chambre froide a un numéro d'identification",
            },
            {
              nativeInputProps: {
                name: 'ccg_mode',
                onChange: () => setMode('full'),
              },
              label: "Non, ma chambre froide n'a pas de numéro d'identification",
            },
          ]}
        />
      )}

      {mode === 'quick' && (
        <form method="POST" className="w-full gap-4" onSubmit={handleQuickAdd}>
          <Input
            label="Numéro d'identification *"
            state={error ? 'error' : 'default'}
            stateRelatedMessage={error}
            hintText="De la forme 03-CCG-123, ou encore 03.564.345"
            nativeInputProps={{
              type: 'text',
              placeholder: 'Exemples : 03-CCG-123, ou encore 03.564.345',
              id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              required: true,
              name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
            }}
          />
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {!isSubmitting ? 'Ajouter cette chambre froide' : 'Recherche en cours...'}
            </Button>
            <Button
              type="button"
              priority="tertiary no outline"
              onClick={() => {
                setMode('select');
                setError('');
              }}
            >
              Retour
            </Button>
          </div>
        </form>
      )}

      {mode === 'full' && (
        <form id="ccg_data_form" method="POST" onSubmit={handleFullSubmit}>
          <p className="mb-4 font-semibold">Pré-enregistrer une nouvelle chambre froide (CCG)</p>
          <Input
            label="Nom usuel *"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.nom_d_usage,
              name: Prisma.EntityScalarFieldEnum.nom_d_usage,
              autoComplete: 'off',
              required: true,
            }}
          />
          <Input
            label="SIRET"
            hintText="Si vous n'en n'avez pas, laissez vide."
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.siret,
              name: Prisma.EntityScalarFieldEnum.siret,
              autoComplete: 'off',
            }}
          />
          <Input
            label="Numéro d'identification du CCG"
            hintText="De la forme 03-CCG-123, ou encore 03.564.345. Remplissez-le si vous le connaissez."
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              autoComplete: 'off',
            }}
          />
          <Input
            label="Adresse *"
            hintText="Indication : numéro et voie"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.address_ligne_1,
              name: Prisma.EntityScalarFieldEnum.address_ligne_1,
              autoComplete: 'off',
              required: true,
            }}
          />
          <Input
            label="Complément d'adresse (optionnel)"
            hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.address_ligne_2,
              name: Prisma.EntityScalarFieldEnum.address_ligne_2,
              autoComplete: 'off',
            }}
          />
          <div className="flex w-full flex-col gap-x-4 md:flex-row">
            <Input
              label="Code postal *"
              hintText="5 chiffres"
              className="shrink-0 md:basis-1/5"
              nativeInputProps={{
                id: Prisma.EntityScalarFieldEnum.code_postal,
                name: Prisma.EntityScalarFieldEnum.code_postal,
                autoComplete: 'off',
                required: true,
                value: ccgPostalCode,
                onChange: (e) => setCCGPostalCode(e.currentTarget.value),
              }}
            />
            <div className="basis-4/5">
              <InputVille
                postCode={ccgPostalCode}
                trimPostCode
                label="Ville ou commune *"
                hintText="Exemple : Montpellier"
                nativeInputProps={{
                  id: Prisma.EntityScalarFieldEnum.ville,
                  name: Prisma.EntityScalarFieldEnum.ville,
                  autoComplete: 'off',
                  required: true,
                }}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <p className="my-4 text-sm">
            Ceci ne remplace pas la déclaration officielle du CCG. Cela permet simplement de pouvoir en faire
            référence dans Zacharie, en attendant son enregistrement.
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {!isSubmitting ? 'Enregistrer ma chambre froide' : 'Enregistrement en cours...'}
            </Button>
            <Button
              type="button"
              priority="tertiary no outline"
              onClick={() => {
                setMode('select');
                setError('');
                setCCGPostalCode('');
              }}
            >
              Retour
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
