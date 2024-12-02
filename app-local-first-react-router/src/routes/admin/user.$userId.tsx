import { useState, type RefObject, useRef, useMemo, useEffect } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { Entity, EntityRelationType, UserRoles, Prisma, UserNotifications } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import RolesCheckBoxes from '@app/components/RolesCheckboxes';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import type { AdminUserDataResponse } from '@api/src/types/responses';
import { Link, useParams } from 'react-router';
import Chargement from '@app/components/Chargement';

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
    user_entities_vivible_checkbox: false,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: null,
    last_seen_at: null,
    deleted_at: null,
    onboarded_at: null,
    notifications: [UserNotifications.EMAIL, UserNotifications.PUSH],
    web_push_tokens: [],
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
    fetch(`${import.meta.env.VITE_API_URL}/user/${params.userId}`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(Object.fromEntries(formData)),
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
      tabId: 'Salarié de / Dirigeant de / Propriétaire de',
      label: `Salarié de / Dirigeant de / Propriétaire de (${userEntitiesRelations.filter((rel) => rel.relation === EntityRelationType.WORKING_FOR).length})`,
    },
    {
      tabId: 'Partenaire de',
      label: `Partenaire de (${userEntitiesRelations.filter((rel) => rel.relation === EntityRelationType.WORKING_WITH).length})`,
    },
  ];

  if (!user.id) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {user.prenom ? `${user.prenom} ${user.nom_de_famille}` : user.email} | Admin | Zacharie | Ministère de
        l'Agriculture
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
              className="mb-6 bg-white md:shadow [&_.fr-tabs\_\_list]:!bg-alt-blue-france [&_.fr-tabs\_\_list]:!shadow-none"
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
                  <div className="relative flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
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
                  <input type="hidden" name="route" value={`/api/action/user/${user.id}`} />
                  <input type="hidden" name={Prisma.UserScalarFieldEnum.prefilled} value="true" />
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>

                  <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
                    <Input
                      label="Code postal"
                      hintText="Format attendu : 5 chiffres"
                      className="shrink-0"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.code_postal,
                        name: Prisma.UserScalarFieldEnum.code_postal,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: user.code_postal ?? '',
                      }}
                    />
                    <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
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
                    <div className="fr-fieldset__element">
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
                    </div>
                  )}
                  <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
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
              {selectedTabId === 'Salarié de / Dirigeant de / Propriétaire de' && (
                <WorkingWithOrFor
                  relation={EntityRelationType.WORKING_FOR}
                  fetcherKey="working-for"
                  userResponseData={userResponseData}
                  setUserResponseData={setUserResponseData}
                />
              )}
              {selectedTabId === 'Partenaire de' && (
                <WorkingWithOrFor
                  userResponseData={userResponseData}
                  setUserResponseData={setUserResponseData}
                  relation={EntityRelationType.WORKING_WITH}
                  fetcherKey="working-with"
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

interface WorkingWithOrForProps {
  relation: EntityRelationType;
  fetcherKey: string;
  userResponseData: State;
  setUserResponseData: (data: State) => void;
}

function WorkingWithOrFor({
  relation,
  fetcherKey,
  userResponseData,
  setUserResponseData,
}: WorkingWithOrForProps) {
  const { user, userEntitiesRelations, allEntities } = userResponseData;

  const potentialEntities = useMemo(() => {
    const userEntityIds: Record<Entity['id'], boolean> = {};
    for (const userEntityRelation of userEntitiesRelations) {
      if (userEntityRelation.relation === relation) {
        userEntityIds[userEntityRelation.id] = true;
      }
    }
    const entities = [];
    for (const entity of allEntities) {
      if (!userEntityIds[entity.id]) {
        entities.push(entity);
      }
    }
    return entities;
  }, [allEntities, userEntitiesRelations, relation]);

  return (
    <>
      {userEntitiesRelations
        .filter((entity) => entity.relation === relation)
        .map((entity) => {
          return (
            <div key={entity.id} className="fr-fieldset__element">
              <Notice
                className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
                style={{
                  boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
                }}
                isClosable
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
                    className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                  >
                    {entity.nom_d_usage}
                    <br />
                    {getUserRoleLabel(entity.type)}
                    <br />
                    {entity.siret}
                    {entity.numero_ddecpp}
                    <br />
                    {entity.code_postal} {entity.ville}
                  </Link>
                }
              />
            </div>
          );
        })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
        <Table
          fixed
          noCaption
          className="[&_td]:h-px"
          data={potentialEntities.map((entity) => [
            <form
              key={entity.id}
              id={fetcherKey}
              className="fr-fieldset__element flex w-full flex-col items-start gap-4"
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
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
              >
                {entity.nom_d_usage}
                <br />
                {entity.siret}
                {entity.numero_ddecpp}
                <br />
                {entity.code_postal} {entity.ville}
              </Link>
              <Button type="submit">Ajouter</Button>
            </form>,
            <p
              key={user.id}
              className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
            >
              {entity.type}
            </p>,
          ])}
          headers={['Entité', 'Type']}
        />
      </div>
    </>
  );
}
