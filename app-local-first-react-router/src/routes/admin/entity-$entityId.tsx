import { useState, useRef, Fragment, useMemo, useEffect } from 'react';
import Checkbox from '@codegouvfr/react-dsfr/Checkbox';
import { Link, useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { EntityRelationType, EntityTypes, UserRoles, Prisma, User } from '@prisma/client';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import InputVille from '@app/components/InputVille';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type { AdminGetEntityResponse, AdminActionEntityResponse } from '@api/src/types/responses';
import type { EntityForAdmin } from '@api/src/types/entity';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import InputNotEditable from '@app/components/InputNotEditable';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { toast } from 'react-toastify';
const loadData = (entityId: string): Promise<AdminGetEntityResponse> =>
  API.get({ path: `admin/entity/${entityId}` }).then((res) => res as AdminGetEntityResponse);

type State = NonNullable<AdminGetEntityResponse['data']>;

const initialData: State = {
  entity: {
    id: '',
    brevo_id: null,
    type: EntityTypes.ETG,
    nom_d_usage: '',
    raison_sociale: '',
    siret: '',
    numero_ddecpp: '',
    address_ligne_1: '',
    address_ligne_2: '',
    code_postal: '',
    ville: '',
    prefilled: false,
    ccg_status: null,
    etg_linked_to_svi_id: null,
    at_least_one_fei_treated: null,
    zacharie_compatible: false,
    for_testing: false,
    EntityRelationsWithUsers: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    onboarded_at: null,
    is_synced: true,
    nom_prenom_responsable: null,
    prefecture_svi: null,
    inc_certificat: 0,
    inc_decision: 0,
    code_etbt_certificat: null,
  },
  dedicatedApiKey: null,
  canTakeFichesForEntity: [],
  canSendFichesToEntity: [],
  sviRelatedToETG: null,
  etgsRelatedWithSvi: [],
  potentialSvisRelatedToETG: [],
  potentialEtgsRelatedWithSvi: [],
};
export default function AdminEntity() {
  const params = useParams();
  const [adminEntityResponse, setAdminEntityResponse] = useState<State>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const {
    // entity,
    dedicatedApiKey,
    canTakeFichesForEntity,
    canSendFichesToEntity,
    sviRelatedToETG,
    etgsRelatedWithSvi,
  } = adminEntityResponse ?? initialData;
  const entity = adminEntityResponse.entity as EntityForAdmin;

  useEffect(() => {
    loadData(params.entityId!).then((response) => {
      if (response.data) setAdminEntityResponse(response.data!);
    });
  }, [params.entityId]);

  const formRef = useRef<HTMLFormElement>(null);
  const [selectedTabId, setSelectedTabId] = useState('Raison Sociale');
  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'Raison Sociale',
      label: 'Raison Sociale',
    },
  ];
  if (entity.type !== EntityTypes.CCG) {
    tabs.push({
      tabId: 'Utilisateurs pouvant traiter des fiches pour cette entité',
      label: `Utilisateurs pouvant traiter des fiches pour cette entité (${entity.EntityRelationsWithUsers.filter((rel) => rel.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY).length})`,
    });
    if (entity.type !== EntityTypes.SVI) {
      tabs.push({
        tabId: 'Utilisateurs pouvant envoyer des fiches à cette entité',
        label: `Utilisateurs pouvant envoyer des fiches à cette entité (${entity.EntityRelationsWithUsers.filter((rel) => rel.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY).length})`,
      });
    }
  }
  if (entity.type === EntityTypes.ETG) {
    tabs.push({
      tabId: 'SVI associé',
      label: `SVI associé`,
    });
  }
  if (entity.type === EntityTypes.SVI) {
    tabs.push({
      tabId: 'ETGs associés',
      label: `ETGs associés (${etgsRelatedWithSvi.length})`,
    });
  }

  async function handleSave(name: string, value: string | boolean) {
    setIsSaving(true);
    API.post({
      path: `admin/entity/${params.entityId}`,
      body: { [name]: value },
    })
      .then((res) => res as AdminActionEntityResponse)
      .then((response) => {
        if (!response.ok) {
          return toast.error(response.error);
        }
        toast.success("L'entité a été mise à jour avec succès");
      })
      .then(() => {
        loadData(params.entityId!).then((response) => {
          if (response.data) setAdminEntityResponse(response.data!);
          if (!response.ok) {
            return toast.error(response.error);
          }
        });
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v relative">
      <title>{`${entity.nom_d_usage} (${entity.type}) | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {isSaving && (
        <div className="bg-action-high-blue-france fixed top-0 right-0">
          <span className="p-4 text-white">Enregistrement en cours</span>
        </div>
      )}
      <div
        className="fr-grid-row fr-grid-row-gutters fr-grid-row--center"
        key={entity.id}
      >
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <small className="mx-8 italic">{entity.type}</small>
          <div className="mx-8 flex items-center justify-between gap-12">
            <h1 className="fr-h2 fr-mb-2w">{entity.nom_d_usage}</h1>
            {dedicatedApiKey ? (
              <Button
                linkProps={{
                  to: `/app/admin/api-key/${dedicatedApiKey.id}`,
                }}
              >
                Aller vers la clé API dédiée
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  API.post({
                    path: `admin/entity-dedicated-api-key/${params.entityId}`,
                  })
                    .then((response) => {
                      if (!response.ok) {
                        return toast.error(response.error);
                      }
                      toast.success("L'entité a été mise à jour avec succès");
                    })
                    .then(() => {
                      loadData(params.entityId!).then((response) => {
                        if (response.data) setAdminEntityResponse(response.data!);
                        if (!response.ok) {
                          return toast.error(response.error);
                        }
                      });
                    });
                }}
                className="shrink-0"
              >
                Activer la clé API dédiée
              </Button>
            )}
          </div>
          <div className="p-4 pb-32 md:p-8 md:pb-0">
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:shadow-none!"
            >
              {selectedTabId === 'Raison Sociale' && (
                <form
                  id="entity_data_form"
                  method="POST"
                  ref={formRef}
                >
                  <div className="flex items-center gap-12">
                    <Checkbox
                      className="mb-4"
                      options={[
                        {
                          label: 'Prêt pour Zacharie',
                          hintText:
                            "Si l'entité peut traiter des fiches Zacharie, recevoir ou en envoyer, cochez la case. Si cette case n'est pas cochée, un message sera affiché à l'utilisateur lorsqu'il voudra transmettre une fiche à cette entité.",
                          nativeInputProps: {
                            required: true,
                            name: Prisma.EntityScalarFieldEnum.zacharie_compatible,
                            value: 'true',
                            checked: entity.zacharie_compatible === true,
                            onChange: async (event) => {
                              event.preventDefault();
                              handleSave(Prisma.EntityScalarFieldEnum.zacharie_compatible, !entity.zacharie_compatible);
                            },
                          },
                        },
                      ]}
                    />
                  </div>

                  <Input
                    label="Nom d'usage"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: entity.nom_d_usage ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />
                  <Input
                    label="Raison Sociale"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.raison_sociale,
                      name: Prisma.EntityScalarFieldEnum.raison_sociale,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: entity.raison_sociale ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />
                  <Input
                    label="SIRET"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.siret,
                      name: Prisma.EntityScalarFieldEnum.siret,
                      autoComplete: 'off',
                      defaultValue: entity.siret ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />
                  <Input
                    label="Numéro DD(ec)PP"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                      name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                      autoComplete: 'off',
                      defaultValue: entity.numero_ddecpp ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />

                  {/*  <Input
                      label="Téléphone"
                      hintText="Format attendu : 01 22 33 44 55"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.,
                        name: Prisma.EntityScalarFieldEnum.telephone,
                        autoComplete: "off",
                        defaultValue: entity.telephone ?? "",
                      }}
                    /> */}
                  <Input
                    label="Adresse"
                    hintText="Indication : numéro et voie"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: entity.address_ligne_1 ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />
                  <Input
                    label="Complément d'adresse (optionnel)"
                    hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      autoComplete: 'off',
                      defaultValue: entity.address_ligne_2 ?? '',
                      onBlur: (e) => handleSave(e.target.name, e.target.value),
                    }}
                  />

                  <div className="flex w-full flex-col gap-x-4 md:flex-row">
                    <Input
                      label="Code postal"
                      hintText="5 chiffres"
                      className="shrink-0 md:basis-1/5"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.code_postal,
                        name: Prisma.EntityScalarFieldEnum.code_postal,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: entity.code_postal ?? '',
                        onBlur: (e) => handleSave(e.target.name, e.target.value),
                      }}
                    />
                    <div className="basis-4/5">
                      <InputVille
                        postCode={entity.code_postal ?? ''}
                        key={entity.ville}
                        trimPostCode
                        label="Ville ou commune"
                        hintText="Exemple : Montpellier"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.ville,
                          name: Prisma.EntityScalarFieldEnum.ville,
                          autoComplete: 'off',
                          required: true,
                          defaultValue: entity.ville ?? '',
                          onBlur: (e) => handleSave(e.target.name, e.target.value),
                        }}
                      />
                    </div>
                  </div>
                  {entity.type === EntityTypes.ETG && (
                    <>
                      <Input
                        label="Préfecture du Service Vétérinaire d'Inspection attaché à l'ETG"
                        hintText="Pour générer des certificats et des consignes. Ce que vous indiquerez s'affichera tel quel, donc notez bien en entier 'Préfecture d'Eure-et-Loire' par exemple, il n'y a aucune intelligence derrière"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.prefecture_svi,
                          name: Prisma.EntityScalarFieldEnum.prefecture_svi,
                          autoComplete: 'off',
                          placeholder: "Préfecture d'Eure-et-Loire",
                          defaultValue: entity.prefecture_svi ?? '',
                          onBlur: (e) => handleSave(e.target.name, e.target.value),
                        }}
                      />
                      <Input
                        label="Prénom et Nom du responsable de l'ETG"
                        hintText="Pour générer des certificats et des consignes. 'Jean Dupont', par exemple"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.nom_prenom_responsable,
                          name: Prisma.EntityScalarFieldEnum.nom_prenom_responsable,
                          autoComplete: 'off',
                          placeholder: 'M. Jean Dupont',
                          defaultValue: entity.nom_prenom_responsable ?? '',
                          onBlur: (e) => handleSave(e.target.name, e.target.value),
                        }}
                      />
                      <InputNotEditable
                        label="Code Établissement"
                        hintText="Pour générer des numéros de certificats et de consignes. Généré automatiquement lors de la création de l'ETG. Ne peut pas être modifié"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.code_etbt_certificat,
                          name: Prisma.EntityScalarFieldEnum.code_etbt_certificat,
                          autoComplete: 'off',
                          defaultValue: entity.code_etbt_certificat ?? '',
                          onBlur: (e) => handleSave(e.target.name, e.target.value),
                        }}
                      />
                    </>
                  )}
                </form>
              )}
              {selectedTabId === 'Utilisateurs pouvant traiter des fiches pour cette entité' && (
                <UserWorkingWithOrFor
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  potentialUsers={canTakeFichesForEntity}
                  relationType={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
                  fetcherKey="working-for"
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'Utilisateurs pouvant envoyer des fiches à cette entité' && (
                <UserWorkingWithOrFor
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  potentialUsers={canSendFichesToEntity}
                  relationType={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
                  fetcherKey="working-with"
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'ETGs associés' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.ETG}
                  description="Si une fiche est envoyée à un ETG associé listé ci-dessous, le Collecteur Pro sera aussi en capacité de la traiter"
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'SVI associé' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.SVI}
                  description={!sviRelatedToETG ? "Un utilisateur d'un ETG ne peut envoyer des fiches qu'à un SVI listé ci-dessous" : ''}
                  setIsSaving={setIsSaving}
                />
              )}
              <div className="mt-6 mb-16 ml-6">
                <a
                  className="fr-link fr-icon-arrow-up-fill fr-link--icon-left"
                  href="#top"
                >
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
  adminEntityResponse: State;
  setAdminEntityResponse: (state: State) => void;
  relationType: EntityRelationType;
  potentialUsers: Array<{
    id: string;
    email: string | null;
    nom_de_famille: string | null;
    prenom: string | null;
    code_postal: string | null;
    ville: string | null;
    roles: UserRoles[];
  }>;
  fetcherKey: string;
  setIsSaving: (isSaving: boolean) => void;
}

function UserWorkingWithOrFor({
  adminEntityResponse,
  setAdminEntityResponse,
  relationType,
  potentialUsers,
  fetcherKey,
  setIsSaving,
}: WorkingWithOrForProps) {
  const { entity } = adminEntityResponse;
  return (
    <>
      {entity.EntityRelationsWithUsers.filter((entity) => entity.relation === relationType).map((entityRelation) => {
        const owner = entityRelation.UserRelatedWithEntity;
        return (
          <RelationEntityUser
            relationType={relationType}
            entity={entity}
            key={owner.id}
            user={owner as User}
            enableUsersView={false}
            displayEntity={false}
            displayUser={true}
            canApproveRelation
            canDelete
            userLink={`/app/admin/user/${owner.id}`}
            onChange={() => {
              loadData(entity.id).then((response) => {
                if (response.data) setAdminEntityResponse(response.data!);
              });
            }}
          />
        );
      })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
        <Table
          fixed
          noCaption
          className="[&_td]:align-middle"
          data={potentialUsers.map((user) => [
            <form
              key={user.id}
              id={fetcherKey}
              className="flex w-full flex-col items-start gap-4"
              method="POST"
              onSubmit={(event) => {
                event.preventDefault();
                setIsSaving(true);
                API.post({
                  path: '/user-entity',
                  body: {
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    relation: relationType,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                  },
                })
                  .then((res) => res as AdminActionEntityResponse)
                  .then((response) => {
                    if (!response.ok) {
                      return toast.error(response.error);
                    }
                    toast.success("L'entité a été mise à jour avec succès");
                  })
                  .then(() => {
                    loadData(entity.id).then((response) => {
                      if (response.data) setAdminEntityResponse(response.data!);
                      if (!response.ok) {
                        return toast.error(response.error);
                      }
                    });
                  })
                  .finally(() => {
                    setIsSaving(false);
                  });
              }}
            >
              <Link
                to={`/app/admin/user/${user.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {user.prenom} {user.nom_de_famille}
                <br />＠ {user.email}
                <br />
                🏡 {user.code_postal} {user.ville}
              </Link>
              <Button
                type="submit"
                className="m-2"
              >
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
          ])}
          headers={['Utilisateur', 'Roles']}
        />
      </div>
    </>
  );
}

function EntitiesRelatedTo({
  adminEntityResponse,
  setAdminEntityResponse,
  entityType,
  description,
  setIsSaving,
}: {
  entityType: EntityTypes;
  adminEntityResponse: State;
  setAdminEntityResponse: (state: State) => void;
  description: string;
  setIsSaving: (isSaving: boolean) => void;
}) {
  const { entity, etgsRelatedWithSvi, sviRelatedToETG, potentialEtgsRelatedWithSvi, potentialSvisRelatedToETG } = adminEntityResponse;

  const entitiesRelated = useMemo(() => {
    switch (entityType) {
      case EntityTypes.ETG:
        return etgsRelatedWithSvi;
      case EntityTypes.SVI:
        return sviRelatedToETG ? [sviRelatedToETG] : [];
      default:
        return [];
    }
  }, [entityType, etgsRelatedWithSvi, sviRelatedToETG]);

  const potentialEntitiesRelated = useMemo(() => {
    switch (entityType) {
      case EntityTypes.ETG:
        return potentialEtgsRelatedWithSvi;
      case EntityTypes.SVI:
        return potentialSvisRelatedToETG;
      default:
        return [];
    }
  }, [entityType, potentialEtgsRelatedWithSvi, potentialSvisRelatedToETG]);

  const showTable = useMemo(() => {
    if (entityType !== EntityTypes.ETG) {
      return entitiesRelated.length === 0;
    }
    return true;
  }, [entitiesRelated, entityType]);

  return (
    <>
      <Highlight
        className="m-0 mb-8"
        classes={{
          root: 'fr-highlight--green-emeraude',
        }}
      >
        {description}
      </Highlight>
      {entitiesRelated.map((coupledEntity) => {
        const etg = entity.type === EntityTypes.ETG ? entity : coupledEntity;
        // const svi = entity.type === EntityTypes.ETG ? coupledEntity : entity;
        return (
          <Notice
            key={coupledEntity.id}
            className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice\\\\_\\\\_title]:before:hidden"
            style={{
              boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
            }}
            isClosable
            onClose={() => {
              setIsSaving(true);
              API.post({
                path: `admin/entity/${etg.id}`,
                body: {
                  etg_linked_to_svi_id: null,
                },
              })
                .then((res) => res as AdminActionEntityResponse)
                .then((response) => {
                  if (!response.ok) {
                    return toast.error(response.error);
                  }
                  toast.success("L'entité a été mise à jour avec succès");
                })
                .then(() => {
                  loadData(entity.id).then((response) => {
                    if (response.data) setAdminEntityResponse(response.data!);
                    if (!response.ok) {
                      return toast.error(response.error);
                    }
                  });
                })
                .finally(() => {
                  setIsSaving(false);
                });
            }}
            title={
              <Link
                to={`/app/admin/entity/${coupledEntity.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {coupledEntity.nom_d_usage}
                <br />
                Raison sociale: {coupledEntity.raison_sociale}
                <br />
                {coupledEntity.siret}
                {coupledEntity.numero_ddecpp}
                <br />
                {coupledEntity.type}
                <br />
                {coupledEntity.address_ligne_1}
                <br />
                {coupledEntity.address_ligne_2}
                <br />
                {coupledEntity.code_postal} {coupledEntity.ville}
              </Link>
            }
          />
        );
      })}
      {showTable && (
        <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
          <Table
            fixed
            noCaption
            className="[&_td]:align-middle"
            data={potentialEntitiesRelated.map((potentialEntityRelated) => {
              const etg = entity.type === EntityTypes.ETG ? entity : potentialEntityRelated;
              const svi = entity.type === EntityTypes.ETG ? potentialEntityRelated : entity;
              return [
                <form
                  key={potentialEntityRelated.id}
                  id={`potentiel-couple-form-${potentialEntityRelated.id}`}
                  className="flex w-full flex-col items-start gap-4"
                  method="POST"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setIsSaving(true);
                    API.post({
                      path: `admin/entity/${etg.id}`,
                      body: {
                        etg_linked_to_svi_id: svi.id,
                      },
                    })
                      .then((res) => res as AdminActionEntityResponse)
                      .then(() => {
                        loadData(entity.id).then((response) => {
                          if (response.data) setAdminEntityResponse(response.data!);
                        });
                      })
                      .finally(() => {
                        setIsSaving(false);
                      });
                  }}
                >
                  <Link
                    to={`/app/admin/entity/${potentialEntityRelated.id}`}
                    className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                  >
                    {potentialEntityRelated.type}
                    <br />
                    {potentialEntityRelated.nom_d_usage}
                  </Link>
                  <Button
                    type="submit"
                    className="m-2"
                    nativeButtonProps={{
                      form: `potentiel-couple-form-${potentialEntityRelated.id}`,
                    }}
                  >
                    Lier
                  </Button>
                </form>,
                <Link
                  key={potentialEntityRelated.id}
                  to={`/app/admin/entity/${potentialEntityRelated.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {potentialEntityRelated.nom_d_usage}
                  {potentialEntityRelated.numero_ddecpp}
                </Link>,
                <Link
                  key={potentialEntityRelated.id}
                  to={`/app/admin/entity/${potentialEntityRelated.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {potentialEntityRelated.address_ligne_1}
                  <br />
                  {potentialEntityRelated.address_ligne_2}
                  <br />
                  {potentialEntityRelated.code_postal} {potentialEntityRelated.ville}
                </Link>,
              ];
            })}
            headers={['Entité', 'Siret', 'Adresse']}
          />
        </div>
      )}
    </>
  );
}
