import { useState, useCallback, useEffect, Fragment } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import {
  EntityTypes,
  EntityRelationType,
  UserRoles,
  Prisma,
  Entity,
  EntityRelationStatus,
} from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import { useNavigate, useSearchParams } from 'react-router';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import type { UserCCGsResponse, UserEntityResponse } from '@api/src/types/responses';
import InputNotEditable from '@app/components/InputNotEditable';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
};

type InformationsDeChasseProps = {
  withExaminateurInitial?: boolean;
  withAssociationsDeChasse?: boolean;
  withCCGs?: boolean;
};

export default function MesInformationsDeChasse({
  withExaminateurInitial = false,
  withAssociationsDeChasse = false,
  withCCGs = false,
}: InformationsDeChasseProps) {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  let withEverything = withExaminateurInitial && withAssociationsDeChasse && withCCGs;

  const user = useUser((state) => state.user)!;

  const [isExaminateurInitial, setIsExaminateurInitial] = useState(
    user.est_forme_a_l_examen_initial === true,
  );
  const [numeroCfei, setNumeroCfei] = useState(user.numero_cfei ?? '');
  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleUserSubmit = useCallback(
    async ({
      isExaminateurInitial,
      numeroCfei,
      visibilityChecked,
    }: {
      isExaminateurInitial: boolean;
      numeroCfei: string;
      visibilityChecked: boolean;
    }) => {
      const body: Record<string, string | null> = {};
      if (isExaminateurInitial) {
        body.est_forme_a_l_examen_initial = 'true';
        body.numero_cfei = numeroCfei || null;
      } else {
        body.est_forme_a_l_examen_initial = 'false';
        body.numero_cfei = null;
      }
      body.user_entities_vivible_checkbox = visibilityChecked ? 'true' : 'false';
      const response = await API.post({
        path: `user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const nextTitle = 'Mes notifications';
  const nextPage = '/app/tableau-de-bord/mon-profil/mes-notifications';

  const showEntrpriseVisibilityCheckbox =
    !!user.checked_has_asso_de_chasse ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG);

  let title = '';
  if (withEverything) {
    title = 'Mes informations de chasse';
  } else if (withAssociationsDeChasse) {
    title = 'Mes associations de chasse';
  } else if (withCCGs) {
    title = 'Mes chambres froides (CCGs)';
  }

  let calloutTitle = '';
  if (withEverything) {
    calloutTitle = 'Renseignez vos informations de chasse';
  } else if (withAssociationsDeChasse) {
    calloutTitle = 'Renseignez vos associations de chasse';
  } else if (withCCGs) {
    calloutTitle = 'Renseignez vos chambres froides (CCGs)';
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`${title} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          {withEverything && (
            <Stepper
              currentStep={3}
              nextTitle={nextTitle}
              stepCount={4}
              title={
                user.roles.includes(UserRoles.CHASSEUR)
                  ? 'Mes informations de chasse'
                  : 'Mes chambres froides (CCGs)'
              }
            />
          )}
          <h1 className="fr-h2 fr-mb-2w">{calloutTitle}</h1>
          <CallOut title="⚠️ Informations essentielles pour faire des fiches" className="bg-white">
            Ces informations seront reportées automatiquement sur chacune des fiches que vous allez créer.
          </CallOut>
          {withExaminateurInitial && user.roles.includes(UserRoles.CHASSEUR) && (
            <>
              <div className="mb-6 bg-white md:shadow-sm">
                <div className="p-4 md:p-8">
                  <form id="user_data_form" method="POST" onSubmit={(e) => e.preventDefault()}>
                    <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
                      <span>Examen initial</span>
                    </h3>
                    <RadioButtons
                      legend="Êtes-vous formé à l'examen initial ? *"
                      orientation="horizontal"
                      options={[
                        {
                          nativeInputProps: {
                            required: true,
                            checked: isExaminateurInitial,
                            name: Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial,
                            onChange: () => {
                              setIsExaminateurInitial(true);
                              handleUserSubmit({ isExaminateurInitial: true, numeroCfei, visibilityChecked });
                            },
                          },
                          label: 'Oui',
                        },
                        {
                          nativeInputProps: {
                            required: true,
                            checked: !isExaminateurInitial,
                            name: 'pas_forme_a_l_examen_initial',
                            onChange: () => {
                              if (
                                !user.numero_cfei ||
                                window.confirm("N'êtes vous vraiment pas formé à l'examen initial ?")
                              ) {
                                setIsExaminateurInitial(false);
                                handleUserSubmit({
                                  isExaminateurInitial: false,
                                  numeroCfei,
                                  visibilityChecked,
                                });
                              }
                            },
                          },
                          label: 'Non',
                        },
                      ]}
                    />
                    {user.roles.includes(UserRoles.CHASSEUR) && isExaminateurInitial && (
                      <Input
                        label="Numéro d'attestation de Chasseur Formé à l'Examen Initial *"
                        hintText="De la forme CFEI-DEP-AA-123"
                        key={isExaminateurInitial ? 'true' : 'false'}
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.numero_cfei,
                          name: Prisma.UserScalarFieldEnum.numero_cfei,
                          onBlur: () =>
                            handleUserSubmit({ isExaminateurInitial, numeroCfei, visibilityChecked }),
                          autoComplete: 'off',
                          required: true,
                          value: numeroCfei,
                          onChange: (e) => {
                            setNumeroCfei(e.currentTarget.value);
                          },
                        }}
                      />
                    )}
                  </form>
                </div>
              </div>
            </>
          )}

          {withAssociationsDeChasse && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3
                  className="mb-8 text-lg font-semibold text-gray-900"
                  id={`onboarding-etape-2-associations-data-title`}
                >
                  Mon association / société / domaine de chasse
                </h3>
                <MesAssociationsDeChasse />
              </div>
            </div>
          )}

          {withCCGs && <MesCCGs />}
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              {showEntrpriseVisibilityCheckbox && (
                <>
                  <form
                    id="user_data_form"
                    method="POST"
                    onSubmit={(e) => e.preventDefault()}
                    className="px-8"
                  >
                    <Checkbox
                      options={[
                        {
                          label:
                            "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
                          hintText:
                            'Cette autorisation est obligatoire pour le bon fonctionnement de Zacharie, sans quoi les fiches ne pourront pas être attribuées à votre entreprise',
                          nativeInputProps: {
                            required: true,
                            name: Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox,
                            value: 'true',
                            onChange: () => {
                              setVisibilityChecked(!visibilityChecked);
                              handleUserSubmit({
                                isExaminateurInitial,
                                numeroCfei,
                                visibilityChecked: !visibilityChecked,
                              });
                            },
                            checked: visibilityChecked,
                          },
                        },
                      ]}
                    />
                  </form>
                </>
              )}
              <div className="mt-6 ml-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Enregistrer et Continuer',
                    disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => navigate(redirect ?? nextPage),
                    },
                  },
                  {
                    children: redirect ? 'Retour' : 'Modifier mes coordonnées',
                    linkProps: {
                      to: redirect ?? '/app/tableau-de-bord/mon-profil/mes-coordonnees',
                      href: '#',
                    },
                    priority: 'secondary',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MesAssociationsDeChasse() {
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
      body.checked_has_asso_de_chasse = checked_has_asso_de_chasse ? 'true' : 'false';
      const response = await API.post({
        path: `user/${user.id}`,
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
          path: `user/user-entity/${user.id}`,
          body: {
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            _action: 'create',
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
                <p className="mb-5 text-sm text-gray-500">
                  * Les champs marqués d'un astérisque (*) sont obligatoires.
                </p>
                <form id="association_data_form" method="POST" onSubmit={handleEntitySubmit}>
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
                    onCreateOption={async (raison_sociale) => {
                      setNewEntityNomDUsage(raison_sociale);
                      setIsUnregisteredEntity(true);
                      setAssoPostalCode('');
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
                    className="mb-6"
                  />
                  {/* <SelectCustom
                key={'SIRET select' + currentEntityId}
                options={selectOptions}
                getOptionLabel={(entity) =>
                  `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville} - ${entity.siret}`
                }
                getOptionValue={(entity) => entity.id}
                formatOptionLabel={(entity, options) => {
                  if (options.context === 'menu') {
                    if (!entity.code_postal) return `${entity.nom_d_usage} - ${entity.siret}`;
                    return `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville} - ${entity.siret}`;
                  }
                  return entity.siret;
                }}
                label="SIRET"
                name={Prisma.EntityScalarFieldEnum.siret}
                placeholder=""
                creatable={false}
                value={selectValue}
                onChange={(newEntity) => {
                  if (newEntity?.id) {
                    setCurrentEntityId(newEntity.id);
                    setAssoPostalCode(newEntity.code_postal || '');
                    setNewEntityNomDUsage('');
                  }
                }}
                isClearable={!!currentEntityId}
                required={true}
                inputId={Prisma.EntityScalarFieldEnum.siret}
                classNamePrefix={Prisma.EntityScalarFieldEnum.siret}
                className="mb-6"
              /> */}
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
                  <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                    Me rattacher à cette entité
                  </Button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </Fragment>
  );
}

function MesCCGs() {
  const [userCCGs, setUserCCGs] = useState<Array<Entity>>([]);
  const user = useUser((state) => state.user)!;

  // Add this handler for CCG radio buttons
  const handleUserSubmit = useCallback(
    async (checked_has_ccg: boolean) => {
      const body: Record<string, string | null> = {};
      body.checked_has_ccg = checked_has_ccg ? 'true' : 'false';
      const response = await API.post({
        path: `user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  function refreshUserCCGs() {
    API.get({ path: 'user/my-ccgs' })
      .then((res) => res as UserCCGsResponse)
      .then((res) => {
        if (res.ok) {
          setUserCCGs(res.data.userCCGs);
        }
      });
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshUserCCGs();
  }, []);

  const [explicitelySaidNoCCG, setExplicitelySaidNoCCG] = useState(false);
  const [newCCGExpanded, setNewCCGExpanded] = useState(false);
  const [registerOneMoreCCG, setRegisterOneMoreCCG] = useState(false);
  const [ccgPostalCode, setCCGPostalCode] = useState('');
  const handleNewCCGSubmit = useCallback(async (event: React.FocusEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body: Partial<Entity> = Object.fromEntries(formData.entries());
    const response = await API.post({
      path: 'entite/ccg',
      body,
    }).then((response) => response as UserConnexionResponse);
    if (response.ok) {
      refreshUserCCGs();
      setCCGPostalCode('');
      setNewCCGExpanded(false);
      setRegisterOneMoreCCG(false);
      document.getElementById('onboarding-etape-2-ccgs-data')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  function RegisterCCG() {
    return (
      <p className="mt-4 text-sm">
        <br />
        Le CCG identifié dans Zacharie peut être utilisé pour entreposer du gibier. Toutefois, il est
        important de reconnaître officiellement le CCG en procédant à son enregistrement auprès de la
        direction départementale en charge de la protection des populations (DDPP/DDETSPP) du département
        d’implantation du CCG.
        <br />
        Pour déclarer l’activité du CCG, il vous suffit de cliquer{' '}
        <a
          href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
          target="_blank"
          rel="noreferrer noopener"
        >
          ici
        </a>{' '}
        pour accéder à notre tutoriel.
      </p>
    );
  }

  return (
    <div className="mb-6 bg-white md:shadow-sm" id="onboarding-etape-2-ccgs-data">
      <div className="p-4 md:p-8">
        <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
          <span>Chambres froides (Centres de Collecte du Gibier sauvage)</span>
        </h3>
        {!userCCGs.length && (
          <RadioButtons
            legend="Utilisez-vous une ou plusieurs chambres froides pour entreposer votre gibier avant son transport ?"
            hintText="Une chambre froide est aussi appelée Centre de Collecte du Gibier sauvage (CCG)."
            orientation="vertical"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: !!user.checked_has_ccg && !newCCGExpanded,
                  name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                  onClick: () => {
                    handleUserSubmit(true);
                    setNewCCGExpanded(false);
                    setRegisterOneMoreCCG(true);
                    setExplicitelySaidNoCCG(false);
                  },
                },
                label: 'Oui et la chambre froide a un numéro d’identification',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: !!user.checked_has_ccg && newCCGExpanded,
                  name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                  onClick: () => {
                    handleUserSubmit(true);
                    setNewCCGExpanded(true);
                    setRegisterOneMoreCCG(true);
                    setExplicitelySaidNoCCG(false);
                  },
                },
                label: 'Oui mais la chambre froide n’a pas de numéro d’identification',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: explicitelySaidNoCCG,
                  name: 'not_checked_has_ccg',
                  onClick: () => {
                    handleUserSubmit(false);
                    setNewCCGExpanded(false);
                    setRegisterOneMoreCCG(false);
                    setExplicitelySaidNoCCG(true);
                  },
                },
                label: 'Non, je n’utilise pas de chambre froide',
              },
            ]}
          />
        )}

        {/* Only show CCG list and add buttons if user has CCGs or checked_has_ccg is true */}
        {(userCCGs.length > 0 || user.checked_has_ccg) && (
          <>
            {userCCGs.map((entity) => {
              return (
                <Notice
                  key={entity.id}
                  className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice__title]:before:hidden"
                  style={{
                    boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
                  }}
                  isClosable
                  onClose={() => {
                    API.post({
                      path: `user/user-entity/${user.id}`,
                      body: {
                        _action: 'delete',
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
                      },
                    }).then((res) => {
                      if (res.ok) {
                        const nextCCGs = userCCGs.filter((ccg) => ccg.id !== entity.id);
                        if (nextCCGs.length === 0) {
                          handleUserSubmit(false);
                          setNewCCGExpanded(false);
                          setRegisterOneMoreCCG(false);
                        }
                        setUserCCGs(nextCCGs);
                      }
                    });
                  }}
                  title={
                    <>
                      {entity.numero_ddecpp}
                      <br />
                      {entity.nom_d_usage}
                      <br />
                      {entity.code_postal} {entity.ville}
                      {entity.ccg_status === 'Pré-enregistré dans Zacharie' && (
                        <>
                          <RegisterCCG />
                          <p className="mt-4 text-sm">
                            Si vous avez déjà fait la démarche, vous pouvez ignorer ce message.
                          </p>
                        </>
                      )}
                    </>
                  }
                />
              );
            })}
            <div className="mt-8">
              {!registerOneMoreCCG && userCCGs?.length > 0 && (
                <Button
                  type="button"
                  priority="primary"
                  className="mt-4"
                  nativeButtonProps={{
                    onClick: () => setRegisterOneMoreCCG(true),
                  }}
                >
                  Ajouter une chambre froide
                </Button>
              )}
              {!!registerOneMoreCCG && userCCGs?.length > 0 && (
                <RadioButtons
                  legend=""
                  hintText=""
                  orientation="vertical"
                  options={[
                    {
                      nativeInputProps: {
                        required: true,
                        checked: !!user.checked_has_ccg && !newCCGExpanded,
                        name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                        onClick: () => {
                          setNewCCGExpanded(false);
                        },
                      },
                      label: 'Ma chambre froide a un numéro d’identification',
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        checked: !!user.checked_has_ccg && newCCGExpanded,
                        name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                        onClick: () => {
                          setNewCCGExpanded(true);
                        },
                      },
                      label: 'Ma chambre froide n’a pas de numéro d’identification',
                    },
                  ]}
                />
              )}
              {!newCCGExpanded && !!registerOneMoreCCG && (
                <InputCCG
                  key={userCCGs.length}
                  addCCG={(ccg) => {
                    setUserCCGs([...userCCGs, ccg]);
                    setRegisterOneMoreCCG(false);
                  }}
                />
              )}
              {!!newCCGExpanded && !!registerOneMoreCCG && (
                <div className="rounded-lg border border-gray-300 px-8 py-6">
                  <p className="font-semibold">Pré-enregistrer une nouvelle chambre froide (CCG)</p>
                  <p className="mb-5 text-sm text-gray-500">
                    * Les champs marqués d'un astérisque (*) sont obligatoires.
                  </p>
                  <form id="association_data_form" method="POST" onSubmit={handleNewCCGSubmit}>
                    <Input
                      label="Nom usuel *"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                        name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: '',
                      }}
                    />
                    <Input
                      label="SIRET"
                      hintText="Si vous n'en n'avez pas, laissez vide."
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.siret,
                        name: Prisma.EntityScalarFieldEnum.siret,
                        autoComplete: 'off',
                        defaultValue: '',
                      }}
                    />
                    {/* <Input
                      label="Numéro d'identification du CCG"
                      hintText="De la forme 03-CCG-123, ou encore 03.564.345. Si vous ne le connaissez pas, laissez vide."
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        autoComplete: 'off',
                        defaultValue: '',
                      }}
                    /> */}
                    <Input
                      label="Adresse *"
                      hintText="Indication : numéro et voie"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                        name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: '',
                      }}
                    />
                    <Input
                      label="Complément d'adresse (optionnel)"
                      hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                        name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                        autoComplete: 'off',
                        defaultValue: '',
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
                          onChange: (e) => {
                            setCCGPostalCode(e.currentTarget.value);
                          },
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
                            defaultValue: '',
                          }}
                        />
                      </div>
                    </div>
                    <p className="my-4">
                      Ceci ne remplace pas la déclaration officielle du CCG. Cela permet simplement de pouvoir
                      en faire référence dans Zacharie, en attendant son enregistrement (voir ci-dessous).
                    </p>
                    <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                      Enregistrer ma chambre froide (CCG)
                    </Button>
                    <RegisterCCG />
                  </form>
                  <Button
                    type="button"
                    priority="tertiary no outline"
                    className="mt-4"
                    nativeButtonProps={{
                      onClick: () => {
                        setNewCCGExpanded(false);
                        handleUserSubmit(false);
                        setRegisterOneMoreCCG(false);
                        setTimeout(() => {
                          document
                            .getElementById('onboarding-etape-2-ccgs-data')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      },
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InputCCG({ addCCG }: { addCCG: (ccg: Entity) => void }) {
  const user = useUser((state) => state.user)!;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      method="POST"
      className="w-full gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        API.post({
          path: `user/user-entity/${user.id}`,
          body: {
            _action: 'create',
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            [Prisma.EntityScalarFieldEnum.numero_ddecpp]: formData.get(
              Prisma.EntityScalarFieldEnum.numero_ddecpp,
            ),
            [Prisma.EntityScalarFieldEnum.type]: EntityTypes.CCG,
          },
        })
          .then((res) => res as UserEntityResponse)
          .then((res) => {
            setIsSubmitting(false);
            if (res.ok && res.data.entity) {
              setError('');
              addCCG(res.data.entity);
            }
            if (res.error) {
              setError(res.error);
            }
          });
      }}
    >
      <Input
        label="Numéro d'identification"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error}
        nativeInputProps={{
          type: 'text',
          placeholder: 'Exemples : 03-CCG-123, ou encore 03.564.345',
          id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
          required: true,
          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
        }}
      />
      <Button type="submit" disabled={isSubmitting}>
        {!isSubmitting ? 'Ajouter cette chambre froide' : 'Recherche en cours...'}
      </Button>
    </form>
  );
}
