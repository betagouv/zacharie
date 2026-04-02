import { useState, useCallback, useEffect, Fragment } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { EntityTypes, EntityRelationType, Prisma, Entity, EntityRelationStatus } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  // UNUSED - just for typing purposes with the API
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
  [EntityTypes.COMMERCE_DE_DETAIL]: {},
  [EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]: {},
  [EntityTypes.ASSOCIATION_CARITATIVE]: {},
  [EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]: {},
  [EntityTypes.CONSOMMATEUR_FINAL]: {},
};

export default function MesAssociationsDeChasse() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesByTypeAndId, setAllEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (res.ok) {
          setAllEntitiesByTypeAndId(res.data.allEntitiesByTypeAndId);
          setUserEntitiesByTypeAndId(res.data.userEntitiesByTypeAndId);
        }
      });
  }, [refreshKey]);
  const handleUserSubmit = useCallback(
    async (checked_has_asso_de_chasse: boolean) => {
      const body: Record<string, string | null> = {};
      body.checked_has_asso_de_chasse =
        checked_has_asso_de_chasse == null ? null : checked_has_asso_de_chasse ? 'true' : 'false';
      const response = await API.post({
        path: `/user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const userEntities = Object.values(userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR]).filter(
    (entity) => !userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR][entity.id],
  );

  const userHasAssociationsChasses =
    Object.values(userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR]).length > 0;

  const [showForm, setShowForm] = useState(!userHasAssociationsChasses);
  useEffect(() => {
    setShowForm(!userHasAssociationsChasses);
  }, [userHasAssociationsChasses]);

  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const currentEntity = remainingEntities.find((entity) => entity.id === currentEntityId);
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState('');
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

  const [assoPostalCode, setAssoPostalCode] = useState('');
  const handleEntitySubmit = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isUnregisteredEntity) {
        const formData = new FormData(event.currentTarget);
        const body: Partial<Entity> = Object.fromEntries(formData.entries());
        body.raison_sociale = newEntityNomDUsage;
        const response = await API.post({
          path: 'entite/association-de-chasse',
          body,
        }).then((data) => data as UserConnexionResponse);
        if (response.ok) {
          setRefreshKey((prev) => prev + 1);
          setCurrentEntityId(null);
          setAssoPostalCode('');
          setShowForm(false);
          document
            .getElementById('onboarding-etape-2-associations-data-title')
            ?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        API.post({
          path: '/user-entity',
          body: {
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            [Prisma.EntityAndUserRelationsScalarFieldEnum.relation]:
              EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: currentEntityId,
          },
        }).then((res) => {
          if (res.ok) {
            setRefreshKey((k) => k + 1);
            setCurrentEntityId(null);
            setShowForm(false);
            document
              .getElementById('onboarding-etape-2-associations-data-title')
              ?.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    },
    [isUnregisteredEntity, setRefreshKey, user.id, currentEntityId, newEntityNomDUsage],
  );

  return (
    <Fragment key={refreshKey}>
      {!userHasAssociationsChasses && (
        <RadioButtons
          legend="Êtes-vous rattaché à une association / une société / un domaine de chasse ? *"
          orientation="horizontal"
          options={[
            {
              nativeInputProps: {
                required: true,
                checked: !!user.checked_has_asso_de_chasse,
                name: Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse,
                onChange: () => {
                  handleUserSubmit(true);
                },
              },
              label: 'Oui',
            },
            {
              nativeInputProps: {
                required: true,
                checked: !user.checked_has_asso_de_chasse,
                name: 'not_checked_has_asso_de_chasse',
                onChange: () => {
                  handleUserSubmit(false);
                },
              },
              label: 'Non',
            },
          ]}
        />
      )}
      {userEntities
        .filter((entity) => entity.type === EntityTypes.PREMIER_DETENTEUR)
        .map((entity) => {
          const relation = entity.EntityRelationsWithUsers.find(
            (relation) =>
              relation.owner_id === user.id &&
              relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          );
          if (!relation) return null;
          return (
            <RelationEntityUser
              key={relation.id}
              relationType={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
              entity={entity}
              user={user}
              enableUsersView={relation.status === EntityRelationStatus.ADMIN}
              displayEntity={true}
              displayUser={false}
              onChange={() => {
                setRefreshKey((k) => k + 1);
              }}
              refreshKey={refreshKey}
              canDelete
            />
          );
        })}

      {(userHasAssociationsChasses || user.checked_has_asso_de_chasse) && (
        <>
          {!showForm ? (
            <>
              <Button
                priority="secondary"
                className="mt-4"
                nativeButtonProps={{
                  onClick: () => setShowForm(true),
                }}
              >
                Me rattacher à une autre entité
              </Button>
            </>
          ) : (
            <div className="mt-8">
              <div className="rounded-lg border border-gray-300 px-8 py-6">
                {!isUnregisteredEntity && !currentEntityId && (
                  <>
                    <SelectCustom
                      key={'Raison Sociale *' + currentEntityId}
                      options={selectOptions}
                      getOptionLabel={(entity) =>
                        `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`
                      }
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
                      onCreateOption={async (raison_sociale: string) => {
                        setNewEntityNomDUsage(raison_sociale);
                        setIsUnregisteredEntity(true);
                        setAssoPostalCode('');
                        setCurrentEntityId(null);
                      }}
                      label="Rechercher une association, société ou domaine de chasse"
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
                          setNewEntityNomDUsage('');
                          setIsUnregisteredEntity(false);
                        }
                        if (!newEntity) {
                          setCurrentEntityId(null);
                          setAssoPostalCode('');
                          setNewEntityNomDUsage('');
                          setIsUnregisteredEntity(false);
                        }
                      }}
                      isClearable={!!currentEntityId}
                      required={true}
                      inputId={Prisma.EntityScalarFieldEnum.raison_sociale}
                      classNamePrefix={Prisma.EntityScalarFieldEnum.raison_sociale}
                    />
                    <div className="my-4 flex items-center gap-2">
                      <div className="w-full border-b border-gray-200" />
                      <span className="text-sm text-gray-500">ou</span>
                      <div className="w-full border-b border-gray-200" />
                    </div>
                    <Button
                      type="submit"
                      nativeButtonProps={{
                        onClick: () => {
                          setNewEntityNomDUsage('');
                          setIsUnregisteredEntity(true);
                        },
                      }}
                    >
                      Créer une nouvelle association, société ou domaine de chasse
                    </Button>
                  </>
                )}
                {currentEntityId && currentEntity && !isUnregisteredEntity && (
                  <form id="association_data_form" method="POST" onSubmit={handleEntitySubmit}>
                    <div className="bg-contrast-grey rounded-lg p-4">
                      <p className="mb-1 text-lg font-bold">{currentEntity.nom_d_usage}</p>
                      {currentEntity.siret && <p className="mb-1 text-sm">SIRET : {currentEntity.siret}</p>}
                      {currentEntity.address_ligne_1 && (
                        <p className="mb-1 text-sm">{currentEntity.address_ligne_1}</p>
                      )}
                      {currentEntity.address_ligne_2 && (
                        <p className="mb-1 text-sm">{currentEntity.address_ligne_2}</p>
                      )}
                      {(currentEntity.code_postal || currentEntity.ville) && (
                        <p className="text-sm">
                          {currentEntity.code_postal} {currentEntity.ville}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                        Me rattacher à cette entité
                      </Button>
                      <button
                        type="button"
                        className="fr-link fr-link--sm"
                        onClick={() => {
                          setCurrentEntityId(null);
                          setAssoPostalCode('');
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
                {isUnregisteredEntity && (
                  <>
                    <p className="mb-5 text-sm text-gray-500">
                      * Les champs marqués d'un astérisque (*) sont obligatoires.
                    </p>
                    <form id="association_data_form" method="POST" onSubmit={handleEntitySubmit}>
                      <Input
                        label="Raison Sociale *"
                        className="mb-6"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.raison_sociale,
                          name: Prisma.EntityScalarFieldEnum.raison_sociale,
                          required: true,
                          autoComplete: 'off',
                          value: newEntityNomDUsage,
                          onChange: (e) => setNewEntityNomDUsage(e.currentTarget.value),
                        }}
                      />
                      <Input
                        label="SIRET"
                        className="mb-6"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.siret,
                          name: Prisma.EntityScalarFieldEnum.siret,
                          autoComplete: 'off',
                        }}
                      />
                      <Input
                        label="Adresse *"
                        hintText="Indication : numéro et voie"
                        className="mb-6"
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
                        className="mb-6"
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
                            value: assoPostalCode,
                            onChange: (e) => {
                              setAssoPostalCode(e.currentTarget.value);
                            },
                          }}
                        />
                        <div className="basis-4/5">
                          <InputVille
                            postCode={assoPostalCode}
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
                      <div className="mt-4 flex items-center gap-4">
                        <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                          Créer et me rattacher à cette entité
                        </Button>
                        <button
                          type="button"
                          className="fr-link fr-link--sm"
                          onClick={() => {
                            setIsUnregisteredEntity(false);
                            setNewEntityNomDUsage('');
                            setCurrentEntityId(null);
                            setAssoPostalCode('');
                          }}
                        >
                          Chercher une entité existante
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Fragment>
  );
}
