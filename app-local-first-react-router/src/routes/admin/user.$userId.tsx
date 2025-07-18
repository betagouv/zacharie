import { useState, type RefObject, useRef, useMemo, useEffect } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import {
  Entity,
  EntityRelationType,
  UserRoles,
  Prisma,
  UserNotifications,
  EntityTypes,
} from '@prisma/client';
import InputVille from '@app/components/InputVille';
import RolesCheckBoxes from '@app/components/RolesCheckboxes';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import type { AdminUserDataResponse } from '@api/src/types/responses';
import { Link, useParams } from 'react-router';
import Chargement from '@app/components/Chargement';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';

const loadData = (userId: string): Promise<AdminUserDataResponse> =>
  fetch(`${import.meta.env.VITE_API_URL}/admin/user/${userId}`, {
    method: 'GET',
    credentials: 'include',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
  })
    .then((res) => res.json())
    .then((res) => res as AdminUserDataResponse);

type State = NonNullable<AdminUserDataResponse['data']>;

const initialState: State = {
  user: {
    id: '',
    email: '',
    nom_de_famille: '',
    prenom: '',
    telephone: '',
    addresse_ligne_1: '',
    addresse_ligne_2: '',
    code_postal: '',
    ville: '',
    activated: true,
    roles: [],
    numero_cfei: '',
    at_least_one_fei_treated: null,
    user_entities_vivible_checkbox: false,
    prochain_bracelet_a_utiliser: 1,
    created_at: new Date(),
    updated_at: new Date(),
    activated_at: null,
    last_login_at: null,
    last_seen_at: null,
    deleted_at: null,
    onboarded_at: null,
    notifications: [UserNotifications.EMAIL, UserNotifications.PUSH],
    web_push_tokens: [],
    brevo_contact_id: null,
    prefilled: false,
    is_synced: true,
  },
  identityDone: false,
  examinateurDone: false,
  allEntities: [],
  userEntitiesRelations: [],
};

export default function AdminUser() {
  const params = useParams();
  const [userResponseData, setUserResponseData] = useState<State>(initialState);
  const { user, identityDone, examinateurDone, userEntitiesRelations } = userResponseData;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData(params.userId!).then((res) => {
      if (res.ok && res.data) {
        setUserResponseData(res.data as State);
      }
    });
  }, [params.userId]);

  const activeFormRef = useRef<HTMLFormElement>(null);
  const idFormRef = useRef<HTMLFormElement>(null);
  const rolesFormRef = useRef<HTMLFormElement>(null);
  const handleUserFormBlur = (formRef: RefObject<HTMLFormElement>) => () => {
    const formData = new FormData(formRef.current!);

    let body =
      formRef.current!.id === 'user_roles_form'
        ? { roles: formData.getAll('roles') }
        : Object.fromEntries(formData);

    fetch(`${import.meta.env.VITE_API_URL}/user/${params.userId}`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(body),
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then(() => {
        loadData(params.userId!).then((res) => {
          if (res.ok && res.data) {
            setUserResponseData(res.data as State);
          }
          if (!res.ok) {
            alert(res.error);
          }
        });
      });
  };

  const [selectedTabId, setSelectedTabId] = useState('Identité');
  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'Roles',
      label: (user?.roles?.length ? '✅ ' : '') + 'Roles',
    },
    {
      tabId: 'Identité',
      label: (identityDone && examinateurDone ? '✅ ' : '') + 'Identité',
    },
    {
      tabId: 'Peut traiter des fiches au nom de',
      label: `Peut traiter des fiches au nom de (${userEntitiesRelations.filter((rel) => rel.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY).length})`,
    },
  ];

  if (
    user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) &&
    user.roles.filter((r) => r !== UserRoles.ADMIN).length === 1
  ) {
    tabs.pop();
  }

  if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
    tabs.push({
      tabId: 'CCGs',
      label: `CCGs (${userEntitiesRelations.filter((rel) => rel.type === EntityTypes.CCG).length})`,
    });
  }

  if (!user.roles.includes(UserRoles.SVI)) {
    let numberOfWOrkingWith = userEntitiesRelations.filter(
      (rel) =>
        rel.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY && rel.type !== EntityTypes.CCG,
    ).length;
    if (user.roles.includes(UserRoles.ETG)) {
      numberOfWOrkingWith += 1;
    }
    tabs.push({
      tabId: 'Peut envoyer des fiches à',
      label: `Peut envoyer des fiches à (${numberOfWOrkingWith})`,
    });
  }

  if (!user.id) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {`${user.prenom ? `${user.prenom} ${user.nom_de_famille}` : user.email} | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <div className="p-4 pb-32 md:p-8 md:pb-0">
            <div className="flex flex-row items-center justify-between">
              <h1 className="fr-h2 fr-mb-2w">
                {user.prenom ? (
                  <>
                    {user.nom_de_famille} {user.prenom}
                    <br />
                    <small>{user.email}</small>
                  </>
                ) : (
                  <>{user.email}</>
                )}
                <br />
                {!user.activated ? (
                  <small>❌ Utilisateur inactif</small>
                ) : (
                  <small>✅ Utilisateur activé</small>
                )}
              </h1>
              <form
                id="user_active_form"
                method="POST"
                ref={activeFormRef}
                onBlur={handleUserFormBlur(activeFormRef)}
                onSubmit={(event) => event.preventDefault()}
              >
                <input type="hidden" name="route" value={`/api/action/user/${user.id}`} />

                <RadioButtons
                  key={user.activated ? 'true' : 'false'}
                  options={[
                    {
                      label: 'Utilisateur activé',
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.activated,
                        value: 'true',
                        onChange: !user.activated ? handleUserFormBlur(activeFormRef) : undefined,
                        defaultChecked: user.activated,
                      },
                    },
                    {
                      label: 'Utilisateur inactif',
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.activated,
                        value: 'false',
                        onChange: user.activated ? handleUserFormBlur(activeFormRef) : undefined,
                        defaultChecked: !user.activated,
                      },
                    },
                  ]}
                />
              </form>
            </div>
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:bg-alt-blue-france! [&_.fr-tabs\_\_list]:shadow-none!"
            >
              {selectedTabId === 'Roles' && (
                <form
                  id="user_roles_form"
                  method="POST"
                  ref={rolesFormRef}
                  onBlur={handleUserFormBlur(rolesFormRef)}
                  onSubmit={(event) => event.preventDefault()}
                >
                  <input type="hidden" name="route" value={`/api/action/user/${user.id}`} />
                  {user.roles.includes(UserRoles.ADMIN) && (
                    <input type="hidden" name={Prisma.UserScalarFieldEnum.roles} value={UserRoles.ADMIN} />
                  )}
                  <RolesCheckBoxes
                    withAdmin
                    user={user}
                    legend="Sélectionnez tous les rôles de cet utilisateur"
                  />
                  <div className="relative flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                    <ButtonsGroup
                      buttons={[
                        {
                          children: 'Enregistrer',
                          type: 'submit',
                          nativeButtonProps: {
                            form: 'user_roles_form',
                          },
                        },
                      ]}
                    />
                  </div>
                </form>
              )}
              {selectedTabId === 'Identité' && (
                <form
                  id="user_data_form"
                  method="POST"
                  ref={idFormRef}
                  onBlur={handleUserFormBlur(idFormRef)}
                  onSubmit={(event) => event.preventDefault()}
                >
                  <input type="hidden" name={Prisma.UserScalarFieldEnum.prefilled} value="true" />
                  <Input
                    label="Email"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.email,
                      name: Prisma.UserScalarFieldEnum.email,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: user.email ?? '',
                    }}
                  />
                  <Input
                    label="Nom"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.nom_de_famille,
                      name: Prisma.UserScalarFieldEnum.nom_de_famille,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: user.nom_de_famille ?? '',
                    }}
                  />
                  <Input
                    label="Prénom"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.prenom,
                      name: Prisma.UserScalarFieldEnum.prenom,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: user.prenom ?? '',
                    }}
                  />
                  <Input
                    label="Téléphone"
                    hintText="Format attendu : 01 22 33 44 55"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.telephone,
                      name: Prisma.UserScalarFieldEnum.telephone,
                      autoComplete: 'off',
                      defaultValue: user.telephone ?? '',
                    }}
                  />
                  <Input
                    label="Adresse"
                    hintText="Indication : numéro et voie"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                      name: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: user.addresse_ligne_1 ?? '',
                    }}
                  />
                  <Input
                    label="Complément d'adresse (optionnel)"
                    hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                      name: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                      autoComplete: 'off',
                      defaultValue: user.addresse_ligne_2 ?? '',
                    }}
                  />

                  <div className="flex w-full flex-col gap-x-4 md:flex-row">
                    <Input
                      label="Code postal"
                      hintText="5 chiffres"
                      className="shrink-0 md:basis-1/5"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.code_postal,
                        name: Prisma.UserScalarFieldEnum.code_postal,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: user.code_postal ?? '',
                      }}
                    />
                    <div className="basis-4/5">
                      <InputVille
                        key={user.ville}
                        postCode={user.code_postal ?? ''}
                        trimPostCode
                        label="Ville ou commune"
                        hintText="Exemple : Montpellier"
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.ville,
                          name: Prisma.UserScalarFieldEnum.ville,
                          autoComplete: 'off',
                          required: true,
                          defaultValue: user.ville ?? '',
                        }}
                      />
                    </div>
                  </div>
                  {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
                    <Input
                      label="Numéro d'attestation de Chasseur Formé à l'Examen Initial"
                      hintText="De la forme CFEI-DEP-AA-123 ou DEP-FREI-YY-001"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.numero_cfei,
                        name: Prisma.UserScalarFieldEnum.numero_cfei,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: user.numero_cfei ?? '',
                      }}
                    />
                  )}
                  <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                    <ButtonsGroup
                      buttons={[
                        {
                          children: 'Enregistrer',
                          type: 'submit',
                          nativeButtonProps: {
                            form: 'user_data_form',
                          },
                        },
                      ]}
                    />
                  </div>
                </form>
              )}
              {selectedTabId === 'Peut traiter des fiches au nom de' && (
                <PeutEnvoyerDesFichesAOuTraiterAuNomDe
                  relation={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
                  id={selectedTabId}
                  userResponseData={userResponseData}
                  setUserResponseData={setUserResponseData}
                />
              )}
              {selectedTabId === 'CCGs' && (
                <PeutEnvoyerDesFichesAOuTraiterAuNomDe
                  relation={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
                  id={selectedTabId}
                  userResponseData={userResponseData}
                  setUserResponseData={setUserResponseData}
                  forCCG
                />
              )}
              {selectedTabId === 'Peut envoyer des fiches à' && (
                <PeutEnvoyerDesFichesAOuTraiterAuNomDe
                  relation={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
                  id={selectedTabId}
                  userResponseData={userResponseData}
                  setUserResponseData={setUserResponseData}
                />
              )}
              <div className="mb-16 ml-6 mt-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PeutEnvoyerDesFichesAOuTraiterAuNomDeProps {
  relation: EntityRelationType;
  id: string;
  userResponseData: State;
  setUserResponseData: (data: State) => void;
  forCCG?: boolean;
}

function PeutEnvoyerDesFichesAOuTraiterAuNomDe({
  relation,
  id,
  userResponseData,
  setUserResponseData,
  forCCG,
}: PeutEnvoyerDesFichesAOuTraiterAuNomDeProps) {
  const { user, userEntitiesRelations, allEntities } = userResponseData;

  const shouldHaveAssociatedSvi = useMemo(() => {
    if (!user.roles.includes(UserRoles.ETG)) return false;
    if (relation !== EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) return false;
    return true;
  }, [user.roles, relation]);

  const associatedSvi = useMemo(() => {
    if (!shouldHaveAssociatedSvi) return null;
    const etgId = userEntitiesRelations.find((entity) => {
      return (
        entity.type === EntityTypes.ETG &&
        entity.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
      );
    })?.id;
    if (!etgId) return null;
    const sviId = allEntities
      .find((entity) => entity.id === etgId)
      ?.AsEtgRelationsWithOtherEntities.find((entity) => entity.entity_type === EntityTypes.SVI)?.entity_id;
    if (!sviId) return null;
    const svi = allEntities.find((entity) => entity.id === sviId);
    if (!svi) return null;
    return {
      ...svi,
      type: EntityTypes.SVI,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
    };
  }, [allEntities, userEntitiesRelations, shouldHaveAssociatedSvi]);

  const potentialEntities = useMemo(() => {
    const userEntityIds: Record<Entity['id'], boolean> = {};
    for (const userEntityRelation of userEntitiesRelations) {
      if (userEntityRelation.relation === relation) {
        userEntityIds[userEntityRelation.id] = forCCG
          ? userEntityRelation.type === EntityTypes.CCG
          : userEntityRelation.type !== EntityTypes.CCG;
      }
    }
    const entities = [];
    for (const entity of allEntities) {
      if (entity.type === EntityTypes.SVI) {
        if (relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) {
          // cette relation est définie dans l'ETG:
          // si un user a un rôle ETG, alors il peut envoyer une fiche
          // au SVI auquel est rattaché l'ETG via AsEtgRelationsWithOtherEntities
          // donc on ne doit pas afficher cette relation dans la liste des entités potentielles
          // en revanche elle doit être affichée dans la liste des entités, et disabled
          continue;
        }
      }
      if (userEntityIds[entity.id]) continue;
      if (forCCG && entity.type !== EntityTypes.CCG) {
        continue;
      }
      if (!forCCG && entity.type === EntityTypes.CCG) {
        continue;
      }
      if (relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) {
        if (
          user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) ||
          user.roles.includes(UserRoles.PREMIER_DETENTEUR)
        ) {
          if (
            entity.type === EntityTypes.ETG ||
            entity.type === EntityTypes.COLLECTEUR_PRO ||
            entity.type === EntityTypes.CCG
          ) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.ETG)) {
          if (entity.type === EntityTypes.SVI) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
          if (entity.type === EntityTypes.ETG) {
            entities.push(entity);
          }
        }
      } else if (relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
          if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.ETG)) {
          if (entity.type === EntityTypes.ETG) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
          if (entity.type === EntityTypes.COLLECTEUR_PRO || entity.type === EntityTypes.ETG) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.SVI)) {
          if (entity.type === EntityTypes.SVI) {
            entities.push(entity);
          }
        }
      }
    }
    return entities;
  }, [allEntities, userEntitiesRelations, forCCG, relation, user.roles]);

  return (
    <>
      {shouldHaveAssociatedSvi && (
        <Highlight
          className="m-0 mb-8"
          classes={{
            root: 'fr-highlight--green-emeraude',
          }}
        >
          {associatedSvi
            ? "Un utilisateur associé à un SVI ne peut pas envoyer de fiche à un autre SVI que celui auquel est rattaché l'ETG. Conernant l'envoi à d'autres types d'entités (ETG, Collecteur Pro), à l'avenir il pourra le faire."
            : "Veuillez associer un SVI à l'ETG, il sera automatiquement ajouté à la liste des entités auxquelles l'utilisateur peut envoyer des fiches"}
        </Highlight>
      )}
      {[associatedSvi, ...userEntitiesRelations]
        .filter((entity) => {
          if (!entity) return false;
          if (entity.relation !== relation) return false;
          if (forCCG && entity.type !== EntityTypes.CCG) return false;
          if (!forCCG && entity.type === EntityTypes.CCG) return false;
          return true;
        })
        .map((entity) => {
          if (!entity) return null;
          const isSviLinkedToEtg = associatedSvi?.id === entity.id;
          return (
            // @ts-expect-error Types of property 'isClosable' are incompatible. Type 'boolean' is not assignable to type 'true'
            <Notice
              key={entity.id}
              className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice\\\\_\\\\_title]:before:hidden"
              style={{
                boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
              }}
              isClosable={!isSviLinkedToEtg}
              onClose={() => {
                fetch(`${import.meta.env.VITE_API_URL}/user/user-entity/${user.id}`, {
                  method: 'POST',
                  credentials: 'include',
                  body: JSON.stringify({
                    _action: 'delete',
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    relation,
                  }),
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                })
                  .then((res) => res.json())
                  .then(() => {
                    loadData(entity.id).then((response) => {
                      if (response.data) setUserResponseData(response.data!);
                    });
                  });
              }}
              title={
                <Link
                  to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {entity.nom_d_usage}
                  <br />
                  {getUserRoleLabel(entity.type)}
                  <br />
                  {entity.siret}
                  {entity.numero_ddecpp}
                  <br />
                  {entity.code_postal} {entity.ville}
                  <br />
                  <br />
                  {isSviLinkedToEtg && <>(SVI lié à l'ETG, ne peut pas être supprimé)</>}
                </Link>
              }
            />
          );
        })}
      {!!potentialEntities.length && (
        <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
          <Table
            fixed
            noCaption
            className="[&_td]:h-px"
            data={potentialEntities.map((entity) => [
              <form
                key={entity.id}
                id={id}
                className="flex w-full flex-col items-start gap-4"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault();
                  fetch(`${import.meta.env.VITE_API_URL}/user/user-entity/${user.id}`, {
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify({
                      _action: 'create',
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                      relation,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    }),
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                    },
                  })
                    .then((res) => res.json())
                    .then(() => {
                      loadData(user.id).then((response) => {
                        if (response.data) setUserResponseData(response.data!);
                      });
                    });
                }}
              >
                <Link
                  to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {entity.nom_d_usage}
                  <br />
                  {entity.siret}
                  {entity.numero_ddecpp}
                  <br />
                  {entity.code_postal} {entity.ville}
                </Link>
                <Button type="submit" className="m-2">
                  Ajouter
                </Button>
              </form>,
              <p
                key={user.id}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {entity.type}
              </p>,
            ])}
            headers={['Entité', 'Type']}
          />
        </div>
      )}
    </>
  );
}
