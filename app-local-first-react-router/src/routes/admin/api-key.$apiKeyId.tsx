import { useState, type RefObject, useRef, useEffect, Fragment } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, ApiKeyScope, ApiKeyApprovalStatus, Entity, User } from '@prisma/client';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type { AdminApiKeyAndApprovalsResponse } from '@api/src/types/responses';
import { Link, useParams } from 'react-router';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import Checkbox from '@codegouvfr/react-dsfr/Checkbox';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import SelectCustom from '@app/components/SelectCustom';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Tag } from '@codegouvfr/react-dsfr/Tag';

const loadData = (apiKeyId: string): Promise<AdminApiKeyAndApprovalsResponse> =>
  API.get({ path: `admin/api-key/${apiKeyId}` }).then((res) => res as AdminApiKeyAndApprovalsResponse);

type State = NonNullable<AdminApiKeyAndApprovalsResponse['data']>;

const initialState: State = {
  apiKey: {
    name: '',
    id: '',
    slug_for_context: null,
    dedicated_to_entity_id: null,
    access_token: null,
    access_token_read_at: null,
    private_key: '',
    public_key: '',
    description: '',
    webhook_url: '',
    active: false,
    expires_at: null,
    last_used_at: null,
    scopes: [],
    rate_limit: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    approvals: [],
  },
  allEntities: {},
  allUsers: {},
};

export default function AdminApiKey() {
  const params = useParams();
  const [apiKeyReponseData, setApiKeyResponseData] = useState<State>(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const { apiKey } = apiKeyReponseData;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData(params.apiKeyId!).then((res) => {
      if (res.ok && res.data) {
        setApiKeyResponseData(res.data as State);
      }
    });
  }, [params.apiKeyId]);

  const activeFormRef = useRef<HTMLFormElement>(null);
  const idFormRef = useRef<HTMLFormElement>(null);
  const handleApiKeyFormBlur = (formRef: RefObject<HTMLFormElement>) => () => {
    const formData = new FormData(formRef.current!);

    const scopes = formData.getAll(Prisma.ApiKeyScalarFieldEnum.scopes);
    const description = formData.get(Prisma.ApiKeyScalarFieldEnum.description);
    const name = formData.get(Prisma.ApiKeyScalarFieldEnum.name);
    const active = formData.get(Prisma.ApiKeyScalarFieldEnum.active);
    const webhook_url = formData.get(Prisma.ApiKeyScalarFieldEnum.webhook_url);

    const body: Prisma.ApiKeyUncheckedUpdateInput = {};

    if (scopes.length) {
      body[Prisma.ApiKeyScalarFieldEnum.scopes] = scopes.map((scope) => scope as ApiKeyScope);
    }
    if (description) {
      body[Prisma.ApiKeyScalarFieldEnum.description] = description as string;
    }
    if (name) {
      body[Prisma.ApiKeyScalarFieldEnum.name] = name as string;
    }
    if (active) {
      body[Prisma.ApiKeyScalarFieldEnum.active] = active === 'true';
    }
    if (webhook_url) {
      body[Prisma.ApiKeyScalarFieldEnum.webhook_url] = webhook_url as string;
    }

    setIsSaving(true);
    API.post({
      path: `admin/api-key/${params.apiKeyId}`,
      body,
    }).then(() => {
      loadData(params.apiKeyId!)
        .then((res) => {
          if (res.ok && res.data) {
            setApiKeyResponseData(res.data as State);
          }
          if (!res.ok) {
            alert(res.error);
          }
        })
        .finally(() => {
          setIsSaving(false);
        });
    });
  };

  const [selectedTabId, setSelectedTabId] = useState('Informations');
  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'Informations',
      label: 'Informations',
    },
    {
      tabId: 'Entités',
      label: apiKey.dedicated_to_entity_id
        ? 'Entité (1) 🔒'
        : `Entités (${apiKey.approvals.filter((rel) => rel.entity_id).length})`,
    },
    {
      tabId: 'Utilisateurs',
      label: apiKey.dedicated_to_entity_id
        ? 'Utilisateurs (0) 🔒'
        : `Utilisateurs (${apiKey.approvals.filter((rel) => rel.user_id).length})`,
    },
  ];

  if (!apiKey.id) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {`${apiKey.name} - ${apiKey.description} | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      {isSaving && (
        <div className="bg-action-high-blue-france fixed top-0 right-0">
          <span className="p-4 text-white">Enregistrement en cours</span>
        </div>
      )}
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <div className="p-4 pb-32 md:p-8 md:pb-0">
            <Tag
              iconId={
                apiKey.dedicated_to_entity_id
                  ? 'fr-icon-checkbox-circle-line'
                  : 'fr-icon-checkbox-circle-line'
              }
              nativeButtonProps={{
                onClick: function noRefCheck() {},
                className: '-mt-24 mb-6',
              }}
            >
              {apiKey.dedicated_to_entity_id ? 'Clé dédiée à une entité' : 'Clé pour les tierces parties'}
            </Tag>
            <div className="flex flex-row items-center justify-between">
              <h1 className="fr-h2 fr-mb-2w">
                {apiKey.name}
                <br />
                <small>{apiKey.description}</small>
                <br />
                {!apiKey.active ? <small>❌ Clé API inactive</small> : <small>✅ Clé API active</small>}
              </h1>
              <form
                id="user_active_form"
                method="POST"
                ref={activeFormRef}
                onBlur={handleApiKeyFormBlur(activeFormRef)}
                onSubmit={(event) => event.preventDefault()}
              >
                <input type="hidden" name="route" value={`/api/action/api-key/${apiKey.id}`} />

                <RadioButtons
                  key={apiKey.active ? 'true' : 'false'}
                  options={[
                    {
                      label: 'Clé API active',
                      nativeInputProps: {
                        name: Prisma.ApiKeyScalarFieldEnum.active,
                        value: 'true',
                        onChange: !apiKey.active ? handleApiKeyFormBlur(activeFormRef) : undefined,
                        defaultChecked: apiKey.active,
                      },
                    },
                    {
                      label: 'Clé API inactive',
                      nativeInputProps: {
                        name: Prisma.ApiKeyScalarFieldEnum.active,
                        value: 'false',
                        onChange: apiKey.active ? handleApiKeyFormBlur(activeFormRef) : undefined,
                        defaultChecked: !apiKey.active,
                      },
                    },
                  ]}
                />
              </form>
            </div>
            <CallOut>
              {apiKey.dedicated_to_entity_id ? (
                <a href={`${import.meta.env.VITE_API_URL}/v1/docs/cle-dediee`} target="_blank">
                  Cliquez ici pour la documentation API pour les clés dédiées à une entité
                </a>
              ) : (
                <a href={`${import.meta.env.VITE_API_URL}/v1/docs/tierces-parties`} target="_blank">
                  Cliquez ici pour la documentation API pour les clés pour les tierces parties
                </a>
              )}
              .
            </CallOut>
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:shadow-none!"
            >
              {selectedTabId === 'Informations' && (
                <form
                  id="api_key_data_form"
                  method="POST"
                  ref={idFormRef}
                  onBlur={handleApiKeyFormBlur(idFormRef)}
                  onSubmit={(event) => event.preventDefault()}
                >
                  <Input
                    label="Nom"
                    hintText="Le nom du tiers demandeur"
                    nativeInputProps={{
                      id: Prisma.ApiKeyScalarFieldEnum.name,
                      name: Prisma.ApiKeyScalarFieldEnum.name,
                      autoComplete: 'off',
                      // required: true,
                      defaultValue: apiKey.name ?? '',
                    }}
                  />
                  <Input
                    label="Description"
                    hintText="Ce que va faire le tiers demandeur avec la clé API"
                    nativeInputProps={{
                      id: Prisma.ApiKeyScalarFieldEnum.description,
                      name: Prisma.ApiKeyScalarFieldEnum.description,
                      autoComplete: 'off',
                      // required: true,
                      defaultValue: apiKey.description ?? '',
                    }}
                  />
                  <Input
                    label="Paramètre d'URL pour le contexte"
                    hintText="Lorsque cette clé API sera utilisée via la requête GET /nouvelle-fiche, le paramètre `contexte` sera obligatoire et doit valoir cette valeur."
                    disabled
                    nativeInputProps={{
                      id: Prisma.ApiKeyScalarFieldEnum.slug_for_context,
                      name: Prisma.ApiKeyScalarFieldEnum.slug_for_context,
                      autoComplete: 'off',
                      disabled: true,
                      defaultValue: apiKey.slug_for_context ?? '',
                    }}
                  />
                  <Input
                    label="Clé privée"
                    hintText="Clé privée de la clé API, à utiliser pour les appels API par le tiers demandeur"
                    disabled
                    nativeInputProps={{
                      id: Prisma.ApiKeyScalarFieldEnum.private_key,
                      name: Prisma.ApiKeyScalarFieldEnum.private_key,
                      autoComplete: 'off',
                      disabled: true,
                      defaultValue: apiKey.private_key ?? '',
                    }}
                  />
                  <div className="my-4 flex w-full flex-row items-center justify-between">
                    <Button
                      type="button"
                      onClick={() => {
                        API.post({
                          path: `admin/api-key/new-access-token/${apiKey.id}`,
                        }).then((res) => {
                          const link = `${import.meta.env.VITE_API_URL}/v1/api-key/access-token/${res.data.apiKey.access_token}`;
                          window.open(
                            `mailto:?subject=Votre lien pour accéder à la clé privée de l'API Zacharie&body=Bonjour%0A%0AVoici votre lien pour accéder à la clé privée de l'API Zacharie: ${link}%0AUne fois ouvert, ce lien ne sera plus valide. Si vous avez perdu votre clé et que vous avez besoin d'un nouveau lien, veuillez nous contacter.%0A%0AN'hésitez pas à nous contacter si vous avez des questions.%0A%0ACordialement,%0AL'équipe Zacharie.`,
                            '_blank',
                          );
                        });
                      }}
                    >
                      Envoyer un mail avec un lien pour accéder à la clé privée (et au paramètre d'URL pour le
                      contexte)
                    </Button>
                  </div>
                  <Input
                    label="URL de webhook"
                    hintText="URL fournie par le tiers demandeur : lorsqu'une carcasse est mise à jour, on envoie une requête à cette URL. C'est le même fonctionnement qu'un abonnement à des notifications."
                    nativeInputProps={{
                      id: Prisma.ApiKeyScalarFieldEnum.webhook_url,
                      name: Prisma.ApiKeyScalarFieldEnum.webhook_url,
                      autoComplete: 'off',
                      defaultValue: apiKey.webhook_url ?? '',
                    }}
                  />
                  <Checkbox
                    hintText="Une clé api peut permettre d'accéder aux fiches et/ou aux carcasses"
                    legend="Permissions"
                    disabled={false}
                    options={[
                      {
                        label: "Fiches au nom d'un utilisateur",
                        nativeInputProps: {
                          name: Prisma.ApiKeyScalarFieldEnum.scopes,
                          value: ApiKeyScope.FEI_READ_FOR_USER,
                          defaultChecked: apiKey.scopes.includes(ApiKeyScope.FEI_READ_FOR_USER),
                        },
                      },
                      {
                        label: "Fiches au nom d'une entité",
                        nativeInputProps: {
                          name: Prisma.ApiKeyScalarFieldEnum.scopes,
                          value: ApiKeyScope.FEI_READ_FOR_ENTITY,
                          defaultChecked: apiKey.scopes.includes(ApiKeyScope.FEI_READ_FOR_ENTITY),
                        },
                      },
                      {
                        label: "Carcasses au nom d'un utilisateur",
                        nativeInputProps: {
                          name: Prisma.ApiKeyScalarFieldEnum.scopes,
                          value: ApiKeyScope.CARCASSE_READ_FOR_USER,
                          defaultChecked: apiKey.scopes.includes(ApiKeyScope.CARCASSE_READ_FOR_USER),
                        },
                      },
                      {
                        label: "Carcasses au nom d'une entité",
                        nativeInputProps: {
                          name: Prisma.ApiKeyScalarFieldEnum.scopes,
                          value: ApiKeyScope.CARCASSE_READ_FOR_ENTITY,
                          defaultChecked: apiKey.scopes.includes(ApiKeyScope.CARCASSE_READ_FOR_ENTITY),
                        },
                      },
                    ]}
                  />
                  <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                    <ButtonsGroup
                      buttons={[
                        {
                          children: 'Enregistrer',
                          type: 'submit',
                          nativeButtonProps: {
                            form: 'api_key_data_form',
                          },
                        },
                      ]}
                    />
                  </div>
                </form>
              )}
              {selectedTabId === 'Entités' && (
                <EntitiesRelatedTo
                  id={selectedTabId}
                  apiKeyReponseData={apiKeyReponseData}
                  setApiKeyResponseData={setApiKeyResponseData}
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'Utilisateurs' && (
                <UsersRelatedTo
                  id={selectedTabId}
                  apiKeyReponseData={apiKeyReponseData}
                  setApiKeyResponseData={setApiKeyResponseData}
                  setIsSaving={setIsSaving}
                />
              )}
              <div className="mt-6 mb-16 ml-6">
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

interface EntitiesRelatedToProps {
  id: string;
  apiKeyReponseData: State;
  setApiKeyResponseData: (data: State) => void;
  setIsSaving: (isSaving: boolean) => void;
}

function EntitiesRelatedTo({
  apiKeyReponseData,
  setApiKeyResponseData,
  setIsSaving,
}: EntitiesRelatedToProps) {
  const { apiKey, allEntities } = apiKeyReponseData;

  return (
    <>
      <Highlight
        className="mb-8"
        classes={{
          root: 'fr-highlight--green-emeraude',
        }}
      >
        {apiKey.dedicated_to_entity_id
          ? "Cette clé ne pourra accéder qu'aux données de l'entité sélectionnée ci-dessous."
          : "Cette clé ne pourra accéder qu'aux données des entités sélectionnées ci-dessous."}
      </Highlight>
      {apiKey.approvals.map((approval) => {
        if (!approval.Entity) {
          return null;
        }
        const entity = approval.Entity;
        return (
          <div
            key={entity.id}
            className="bg-contrast-grey mb-2 flex basis-full flex-row items-center justify-between border-0 border-solid text-left"
            style={{
              boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
            }}
          >
            <div className="flex flex-1 flex-col border-none p-4 text-left font-bold">
              <Link
                to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {entity.nom_d_usage}
                <br />
                Raison sociale: {entity.raison_sociale}
                <br />
                {entity.siret}
                {entity.numero_ddecpp}
                <br />
                {entity.type}
                <br />
                {entity.address_ligne_1}
                <br />
                {entity.address_ligne_2}
                <br />
                {entity.code_postal} {entity.ville}
              </Link>
            </div>
            <div className="flex flex-row gap-2 pr-4">
              <div className="flex basis-3xs flex-col justify-center gap-2 py-4">
                <ApprovalStatusSelector entity={entity} approval={approval} />
              </div>
              <div className="flex flex-col justify-center gap-2 py-4">
                <Button
                  type="button"
                  iconId="fr-icon-delete-bin-line"
                  onClick={() => {
                    if (!window.confirm('Voulez-vous vraiment retirer cette autorisation ?')) return;
                    setIsSaving(true);
                    API.post({
                      path: `admin/api-key-approval`,
                      body: {
                        api_key_id: apiKey.id,
                        entity_id: entity.id,
                        action: 'delete',
                      },
                    });
                  }}
                  title="Retirer"
                  priority="tertiary no outline"
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
        <Table
          fixed
          noCaption
          className="[&_td]:align-middle"
          data={Object.values(allEntities).map((entity) => {
            return [
              <form
                key={entity.id}
                id={`api-for-${entity.id}`}
                className="flex w-full flex-col items-start gap-4"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault();
                  setIsSaving(true);
                  API.post({
                    path: `admin/api-key-approval`,
                    body: {
                      action: 'create',
                      api_key_id: apiKey.id,
                      entity_id: entity.id,
                      status: ApiKeyApprovalStatus.APPROVED,
                    },
                  })
                    .then((res) => res as AdminApiKeyAndApprovalsResponse)
                    .then(() => {
                      loadData(apiKey.id).then((response) => {
                        if (response.data) setApiKeyResponseData(response.data!);
                      });
                    })
                    .finally(() => {
                      setIsSaving(false);
                    });
                }}
              >
                <Link
                  to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {entity.type}
                  <br />
                  {entity.nom_d_usage}
                </Link>
                <Button
                  type="submit"
                  className="m-2"
                  nativeButtonProps={{
                    form: `api-for-${entity.id}`,
                  }}
                >
                  Sélectionner
                </Button>
              </form>,
              <Link
                key={entity.id}
                to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {entity.nom_d_usage}
                {entity.numero_ddecpp}
              </Link>,
              <Link
                key={entity.id}
                to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {entity.address_ligne_1}
                <br />
                {entity.address_ligne_2}
                <br />
                {entity.code_postal} {entity.ville}
              </Link>,
            ];
          })}
          headers={['Entité', 'Siret', 'Adresse']}
        />
      </div>
    </>
  );
}

interface UsersRelatedToProps {
  id: string;
  apiKeyReponseData: State;
  setApiKeyResponseData: (data: State) => void;
  setIsSaving: (isSaving: boolean) => void;
}

function UsersRelatedTo({ apiKeyReponseData, setApiKeyResponseData, setIsSaving }: UsersRelatedToProps) {
  const { apiKey, allUsers } = apiKeyReponseData;

  return (
    <>
      <Highlight
        className="mb-8"
        classes={{
          root: 'fr-highlight--green-emeraude',
        }}
      >
        Cette clé ne pourra accéder qu'aux données des utilisateurs sélectionnés ci-dessous.
      </Highlight>
      {apiKey.approvals.map((approval) => {
        if (!approval.User) {
          return null;
        }
        const user = approval.User;
        return (
          <div
            className={[
              'flex basis-full flex-row items-center justify-between border-solid text-left',
              'bg-contrast-grey mb-2 border-0',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex flex-1 flex-col border-none p-4 text-left font-bold">
              <Link
                to={`/app/tableau-de-bord/admin/user/${user.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {user.email}
                <br />
                {user.roles.join(', ')}
                <br />
                {user.numero_cfei}
                <br />
                {user.telephone}
                <br />
                {user.addresse_ligne_1}
                <br />
                {user.addresse_ligne_2}
                <br />
                {user.code_postal} {user.ville}
              </Link>
            </div>
            <div className="flex flex-row gap-2 pr-4">
              <div className="flex basis-3xs flex-col justify-center gap-2 py-4">
                <ApprovalStatusSelector user={user} approval={approval} />
              </div>
              <div className="flex flex-col justify-center gap-2 py-4">
                <Button
                  type="button"
                  iconId="fr-icon-delete-bin-line"
                  onClick={() => {
                    if (!window.confirm('Voulez-vous vraiment retirer cette autorisation ?')) return;
                    setIsSaving(true);
                    API.post({
                      path: `admin/api-key-approval`,
                      body: {
                        api_key_id: apiKey.id,
                        user_id: user.id,
                        action: 'delete',
                      },
                    });
                  }}
                  title="Retirer"
                  priority="tertiary no outline"
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
        <Table
          fixed
          noCaption
          className="[&_td]:align-middle"
          data={Object.values(allUsers).map((user) => {
            return [
              <form
                key={user.id}
                id={`api-for-${user.id}`}
                className="flex w-full flex-col items-start gap-4"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault();
                  setIsSaving(true);
                  API.post({
                    path: `admin/api-key-approval`,
                    body: {
                      action: 'create',
                      api_key_id: apiKey.id,
                      user_id: user.id,
                      status: ApiKeyApprovalStatus.APPROVED,
                    },
                  })
                    .then((res) => res as AdminApiKeyAndApprovalsResponse)
                    .then(() => {
                      loadData(apiKey.id).then((response) => {
                        if (response.data) setApiKeyResponseData(response.data!);
                      });
                    })
                    .finally(() => {
                      setIsSaving(false);
                    });
                }}
              >
                <Link
                  to={`/app/tableau-de-bord/admin/user/${user.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {user.prenom} {user.nom_de_famille}
                  <br />＠ {user.email}
                  <br />
                  🏡 {user.code_postal} {user.ville}
                </Link>
                <Button type="submit" className="m-2">
                  Ajouter
                </Button>
              </form>,
              <p
                key={user.id}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {user.roles.map((role) => (
                  <Fragment key={role}>
                    {role}
                    <br />
                  </Fragment>
                ))}
              </p>,
            ];
          })}
          headers={['Utilisateur', 'Roles']}
        />
      </div>
    </>
  );
}

const approvalStatusOptions: Array<{
  label: string;
  value: Approval['status'];
}> = [
  {
    label: 'Approuvé',
    value: ApiKeyApprovalStatus.APPROVED,
  },
  {
    label: 'En attente',
    value: ApiKeyApprovalStatus.PENDING,
  },
  {
    label: 'Rejeté',
    value: ApiKeyApprovalStatus.REJECTED,
  },
];

type Approval = State['apiKey']['approvals'][number];

function ApprovalStatusSelector({
  approval,
  entity,
  user,
}: {
  approval: Approval;
  entity?: Entity;
  user?: User;
}) {
  const [status, setStatus] = useState<Approval['status']>(approval?.status);
  return (
    <SelectCustom
      options={approvalStatusOptions}
      getOptionLabel={(f) => f.label!}
      getOptionValue={(f) => f.value}
      onChange={(f) => {
        const newStatus = f?.value;
        API.post({
          path: `admin/api-key-approval`,
          body: {
            _action: 'update',
            api_key_id: approval.api_key_id,
            entity_id: entity?.id,
            user_id: user?.id,
            status: newStatus,
          },
        }).then((res) => {
          if (res.ok) {
            setStatus(newStatus!);
          }
        });
      }}
      className="w-full bg-white"
      value={approvalStatusOptions.find((opt) => opt.value === status)}
    />
  );
}
