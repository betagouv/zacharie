import { useState, useCallback, useEffect } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { EntityRelationType, Prisma, Entity, EntityRelationStatus, EntityTypes } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { PartenairesResponse, UserEntityResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import useZustandStore from '@app/zustand/store';
import { toast } from 'react-toastify';
import { Alert } from '@codegouvfr/react-dsfr/Alert';

const empytEntitiesByTypeAndId: EntitiesById = {};

interface PartenaireNouveauProps {
  newEntityNomDUsageProps?: string;
  onFinish: (entity: UserEntityResponse['data']['entity']) => void;
}
export default function PartenaireNouveau({ newEntityNomDUsageProps, onFinish }: PartenaireNouveauProps) {
  const user = useUser((state) => state.user)!;
  const entities = useZustandStore((state) => state.entities);
  const [allEntitiesById, setAllEntitiesById] = useState<EntitiesById>(empytEntitiesByTypeAndId);
  const [userEntitiesById, setUserEntitiesById] = useState<EntitiesById>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    API.get({ path: 'entite/partenaires' })
      .then((res) => res as PartenairesResponse)
      .then((res) => {
        if (res.ok) {
          setAllEntitiesById(res.data.allEntitiesById);
          setUserEntitiesById(res.data.userEntitiesById);
        }
      });
  }, [refreshKey]);

  const userEntities = Object.values(userEntitiesById);
  const remainingEntities = Object.values(allEntitiesById).filter((entity) => !userEntitiesById[entity.id]);

  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const currentEntity = remainingEntities.find((entity) => entity.id === currentEntityId);
  const currentEntityUser = currentEntity?.EntityRelationsWithUsers.find(
    (relation) => relation.status === EntityRelationStatus.ADMIN,
  )?.UserRelatedWithEntity;
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState(newEntityNomDUsageProps);
  const [isUnregisteredEntity, setIsUnregisteredEntity] = useState(false);

  const newEntity = newEntityNomDUsage
    ? ({
      nom_d_usage: newEntityNomDUsage,
      id: 'nouvelle',
    } as (typeof remainingEntities)[number])
    : undefined;
  const selectOptions = newEntity ? [newEntity, ...remainingEntities] : remainingEntities;
  const selectValue = newEntityNomDUsage
    ? (selectOptions.find((option) => option.id === 'nouvelle') ?? undefined)
    : (selectOptions.find((option) => option.id === currentEntityId) ?? undefined);

  const isAdminOfEntity =
    newEntityNomDUsage ||
    !currentEntityId ||
    userEntities
      .find((entity) => entity.id === currentEntityId)
      ?.EntityRelationsWithUsers.find(
        (relation) =>
          relation.owner_id === user.id &&
          relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      )?.status === EntityRelationStatus.ADMIN;

  const ComponentToDisplay = isAdminOfEntity ? Input : InputNotEditable;

  const [assoPostalCode, setAssoPostalCode] = useState('');
  const [entityType, setEntityType] = useState<EntityTypes | undefined>(undefined);

  const hasSiret = entityType !== EntityTypes.CONSOMMATEUR_FINAL;

  const handleEntitySubmit = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isUnregisteredEntity || !currentEntityId) {
        const formData = new FormData(event.currentTarget);
        const body: Partial<Entity> = Object.fromEntries(formData.entries());
        body.raison_sociale = newEntityNomDUsage;
        if (!entityType) {
          alert('Veuillez sélectionner un type de partenaire');
          return;
        }
        body.type = entityType!;
        const response = await API.post({
          path: 'entite/partenaire',
          body,
        }).then((data) => data as UserEntityResponse);
        if (response.ok) {
          setRefreshKey((prev) => prev + 1);
          setCurrentEntityId(null);
          setAssoPostalCode('');
          setEntityType(undefined);
          onFinish(response.data.entity!);
          useZustandStore.setState({
            entities: {
              ...entities,
              [response.data.entity!.id]: {
                ...response.data.entity!,
                relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                relationStatus: EntityRelationStatus.ADMIN,
              },
            },
          });
        } else {
          toast.error(response.error || 'Une erreur est survenue lors de la création du partenaire');
        }
      } else {
        API.post({
          path: `user/user-entity/${user.id}`,
          body: {
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            _action: 'create',
            [Prisma.EntityAndUserRelationsScalarFieldEnum.relation]:
              EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: currentEntityId,
          },
        })
          .then((res) => res as UserEntityResponse)
          .then((res) => {
            if (res.ok) {
              setRefreshKey((k) => k + 1);
              setCurrentEntityId(null);
              onFinish(res.data.entity);
              useZustandStore.setState({
                entities: {
                  ...entities,
                  [res.data.entity!.id]: {
                    ...res.data.entity!,
                    relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                    relationStatus: EntityRelationStatus.ADMIN,
                  },
                },
              });
            } else {
              toast.error(res.error || 'Une erreur est survenue lors du rattachement au partenaire');
            }
          });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isUnregisteredEntity, currentEntityId, newEntityNomDUsage, entityType, user.id],
  );

  return (
    <>
      <form id="partenaire_data_form" method="POST" onSubmit={handleEntitySubmit}>
        <Alert closable className="bg-white mb-8" small severity="info" description="Attention : ce formulaire est réservé aux commerces de détail, cantines, associations et consommateurs. Pour envoyer vos carcasses à un Etablissement de Traitement de Gibier Sauvage (ETG), celui-ci doit être inscrit sur Zacharie." />
        <RadioButtons
          legend="Qualité du partenaire *"
          hintText="Est-ce un commerce de détail, repas de chasse ou associatif, ou encore un consommateur final ?"
          orientation="vertical"
          options={[
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.COMMERCE_DE_DETAIL ? true : false,
                name: EntityTypes.COMMERCE_DE_DETAIL,
                onChange: () => {
                  setEntityType(EntityTypes.COMMERCE_DE_DETAIL);
                },
              },
              label: 'Commerce de détail (boucherie, charcuterie, etc.)',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ? true : false,
                name: EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
                onChange: () => {
                  setEntityType(EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE);
                },
              },
              label: 'Cantine ou restauration collective',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.ASSOCIATION_CARITATIVE ? true : false,
                name: EntityTypes.ASSOCIATION_CARITATIVE,
                onChange: () => {
                  setEntityType(EntityTypes.ASSOCIATION_CARITATIVE);
                },
              },
              label: 'Association caritative',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ? true : false,
                name: EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
                onChange: () => {
                  setEntityType(EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF);
                },
              },
              label: 'Repas de chasse ou associatif',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.CONSOMMATEUR_FINAL ? true : false,
                name: EntityTypes.CONSOMMATEUR_FINAL,
                onChange: () => {
                  setEntityType(EntityTypes.CONSOMMATEUR_FINAL);
                },
              },
              label: 'Consommateur final',
            },
          ]}
        />
        {hasSiret && (
          <SelectCustom
            key={'Raison Sociale *' + currentEntityId}
            options={selectOptions}
            getOptionLabel={(entity) => `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`}
            getOptionValue={(entity) => entity.id}
            formatOptionLabel={(entity, options) => {
              if (options.context === 'menu') {
                // @ts-expect-error - __isNew__ and value are not typed
                if (entity.__isNew__) return entity.value;
                if (!entity.code_postal) return entity.nom_d_usage;
                return `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`;
              }
              return entity.nom_d_usage;
            }}
            // @ts-expect-error - onCreateOption is not typed
            onCreateOption={async (raison_sociale) => {
              setNewEntityNomDUsage(raison_sociale);
              setIsUnregisteredEntity(true);
              setAssoPostalCode('');
              setEntityType(undefined);
              setCurrentEntityId(null);
            }}
            label="Raison Sociale *"
            name={Prisma.EntityScalarFieldEnum.raison_sociale}
            placeholder=""
            creatable={true}
            value={selectValue}
            onBlur={(event) => {
              if (!currentEntityId) {
                if (event.target.value) {
                  setNewEntityNomDUsage(event.target.value);
                  setIsUnregisteredEntity(true);
                }
              }
            }}
            onChange={(newEntity) => {
              if (newEntity?.id) {
                setCurrentEntityId(newEntity.id);
                setAssoPostalCode(newEntity.code_postal || '');
                setEntityType(newEntity.type);
                setNewEntityNomDUsage('');
                setIsUnregisteredEntity(false);
              }
              if (!newEntity) {
                setCurrentEntityId(null);
                setAssoPostalCode('');
                setNewEntityNomDUsage('');
                setEntityType(undefined);
                setIsUnregisteredEntity(false);
              }
            }}
            isClearable={!!currentEntityId}
            required={true}
            inputId={Prisma.EntityScalarFieldEnum.raison_sociale}
            classNamePrefix={Prisma.EntityScalarFieldEnum.raison_sociale}
            className="mb-6"
          />
        )}
        {hasSiret && (
          <ComponentToDisplay
            label="SIRET"
            key={'SIRET' + currentEntityId}
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.siret,
              name: Prisma.EntityScalarFieldEnum.siret,
              autoComplete: 'off',
              defaultValue: currentEntity?.siret ?? '',
            }}
          />
        )}
        <ComponentToDisplay
          label="Email du représentant *"
          key={'Email' + currentEntityUser?.id}
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.email,
            name: Prisma.UserScalarFieldEnum.email,
            autoComplete: 'off',
            required: true,
            defaultValue: currentEntityUser?.email ?? '',
          }}
        />
        <div className="flex w-full flex-col gap-x-4 md:flex-row">
          <ComponentToDisplay
            label="Nom du représentant *"
            className="shrink-0 md:basis-1/2"
            key={'Nom' + currentEntityUser?.id + hasSiret}
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.nom_de_famille,
              name: Prisma.UserScalarFieldEnum.nom_de_famille,
              autoComplete: 'off',
              required: true,
              defaultValue: hasSiret ? (currentEntityUser?.nom_de_famille ?? '') : newEntityNomDUsageProps,
            }}
          />
          <ComponentToDisplay
            label="Prénom du représentant *"
            className="shrink-0 md:basis-1/2"
            key={'Prenom' + currentEntityUser?.id}
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.prenom,
              name: Prisma.UserScalarFieldEnum.prenom,
              autoComplete: 'off',
              required: true,
              defaultValue: currentEntityUser?.prenom ?? '',
            }}
          />
        </div>
        <ComponentToDisplay
          label="Adresse *"
          key={'Adresse *' + currentEntityId}
          hintText="Indication : numéro et voie"
          nativeInputProps={{
            id: Prisma.EntityScalarFieldEnum.address_ligne_1,
            name: Prisma.EntityScalarFieldEnum.address_ligne_1,
            autoComplete: 'off',
            required: true,
            defaultValue: currentEntity?.address_ligne_1 ?? '',
          }}
        />
        <ComponentToDisplay
          label="Complément d'adresse (optionnel)"
          hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
          key={"Complément d'adresse (optionnel)" + currentEntityId}
          nativeInputProps={{
            id: Prisma.EntityScalarFieldEnum.address_ligne_2,
            name: Prisma.EntityScalarFieldEnum.address_ligne_2,
            autoComplete: 'off',
            defaultValue: currentEntity?.address_ligne_2 ?? '',
          }}
        />

        <div className="flex w-full flex-col gap-x-4 md:flex-row">
          <ComponentToDisplay
            label="Code postal *"
            hintText="5 chiffres"
            className="shrink-0 md:basis-1/5"
            key={'Code postal *' + currentEntityId}
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.code_postal,
              name: Prisma.EntityScalarFieldEnum.code_postal,
              autoComplete: 'off',
              required: true,
              value: assoPostalCode,
              onChange: (e) => {
                setAssoPostalCode(e.currentTarget.value);
              },
            }}
          />
          <div className="basis-4/5">
            {isAdminOfEntity ? (
              <InputVille
                postCode={assoPostalCode}
                trimPostCode
                key={'Ville ou commune *' + currentEntityId}
                label="Ville ou commune *"
                hintText="Exemple : Montpellier"
                nativeInputProps={{
                  id: Prisma.EntityScalarFieldEnum.ville,
                  name: Prisma.EntityScalarFieldEnum.ville,
                  autoComplete: 'off',
                  required: true,
                  defaultValue: currentEntity?.ville ?? '',
                }}
              />
            ) : (
              <InputNotEditable
                label="Ville ou commune *"
                key={'Ville ou commune *' + currentEntityId}
                hintText="Exemple : Montpellier"
                nativeInputProps={{
                  id: Prisma.EntityScalarFieldEnum.ville,
                  name: Prisma.EntityScalarFieldEnum.ville,
                  autoComplete: 'off',
                  required: true,
                  defaultValue: currentEntity?.ville ?? '',
                }}
              />
            )}
          </div>
        </div>
        <Button type="submit" nativeButtonProps={{ form: 'partenaire_data_form' }}>
          Me rattacher à ce partenaire
        </Button>
      </form>
    </>
  );
}
