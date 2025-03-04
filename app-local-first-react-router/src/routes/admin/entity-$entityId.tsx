import { useState, useRef, Fragment, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { EntityRelationType, EntityTypes, UserRoles, Prisma } from '@prisma/client';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import InputVille from '@app/components/InputVille';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type { AdminGetEntityResponse, AdminActionEntityResponse } from '@api/src/types/responses';
import type { EntityForAdmin } from '@api/src/types/entity';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import InputNotEditable from '@app/components/InputNotEditable';
const loadData = (entityId: string): Promise<AdminGetEntityResponse> =>
  fetch(`${import.meta.env.VITE_API_URL}/admin/entity/${entityId}`, {
    method: 'GET',
    credentials: 'include',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
  })
    .then((res) => res.json())
    .then((res) => res as AdminGetEntityResponse);

type State = NonNullable<AdminGetEntityResponse['data']>;

const initialData: State = {
  entity: {
    id: '',
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
    EntityRelationsWithUsers: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    onboarded_at: null,
    is_synced: true,
  },
  usersWithEntityType: [],
  potentialPartenaires: [],
  svisRelatedToETG: [],
  collecteursRelatedToETG: [],
  etgsRelatedWithEntity: [],
  potentialCollecteursRelatedToETG: [],
  potentialSvisRelatedToETG: [],
  potentialEtgsRelatedWithEntity: [],
};
export default function AdminEntity() {
  const params = useParams();
  const [adminEntityResponse, setAdminEntityResponse] = useState<State>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const {
    // entity,
    usersWithEntityType,
    potentialPartenaires,
    svisRelatedToETG,
    collecteursRelatedToETG,
    etgsRelatedWithEntity,
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
    {
      tabId: 'Utilisateurs pouvant traiter des fiches pour cette entité',
      label: `Utilisateurs pouvant traiter des fiches pour cette entité (${entity.EntityRelationsWithUsers.filter((rel) => rel.relation === EntityRelationType.WORKING_FOR).length})`,
    },
    {
      tabId: 'Utilisateurs pouvant envoyer des fiches à cette entité',
      label: `Utilisateurs pouvant envoyer des fiches à cette entité (${entity.EntityRelationsWithUsers.filter((rel) => rel.relation === EntityRelationType.WORKING_WITH).length})`,
    },
  ];
  if (entity.type === EntityTypes.ETG) {
    tabs.push({
      tabId: 'Collecteur Pro associé',
      label: `Collecteur Pro associé (${collecteursRelatedToETG.length})`,
    });
    tabs.push({
      tabId: 'SVI associé',
      label: `SVI associé (${svisRelatedToETG.length})`,
    });
  }
  if (entity.type === EntityTypes.SVI || entity.type === EntityTypes.COLLECTEUR_PRO) {
    tabs.push({
      tabId: 'ETGs associés',
      label: `ETGs associés (${etgsRelatedWithEntity.length})`,
    });
  }

  return (
    <div className="relative fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {entity.nom_d_usage} ({entity.type}) | Admin | Zacharie | Ministère de l'Agriculture
      </title>
      {isSaving && (
        <div className="fixed top-0 right-0 bg-action-high-blue-france">
          <span className="text-white p-4">Enregistrement en cours</span>
        </div>
      )}
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center" key={entity.id}>
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <small className="italic">{entity.type}</small>
          <h1 className="fr-h2 fr-mb-2w">{entity.nom_d_usage}</h1>
          <div className="p-4 pb-32 md:p-8 md:pb-0">
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="mb-6 bg-white md:shadow [&_.fr-tabs\_\_list]:!bg-alt-blue-france [&_.fr-tabs\_\_list]:!shadow-none"
            >
              {selectedTabId === 'Raison Sociale' && (
                <form
                  id="entity_data_form"
                  method="POST"
                  ref={formRef}
                  onBlur={async (event) => {
                    event.preventDefault();
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    const formData = new FormData(formRef.current!);
                    setIsSaving(true);
                    fetch(`${import.meta.env.VITE_API_URL}/admin/entity/${params.entityId}`, {
                      method: 'POST',
                      credentials: 'include',
                      body: JSON.stringify(Object.fromEntries(formData)),
                      headers: new Headers({
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                      }),
                    })
                      .then((res) => res.json())
                      .then((res) => res as AdminActionEntityResponse)
                      .then(() => {
                        loadData(params.entityId!).then((response) => {
                          if (response.data) setAdminEntityResponse(response.data!);
                        });
                      })
                      .finally(() => {
                        setIsSaving(false);
                      });
                  }}
                >
                  <Input
                    label="Nom d'usage"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: entity.nom_d_usage ?? '',
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
                    }}
                  />
                  <Input
                    label="SIRET"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.siret,
                      name: Prisma.EntityScalarFieldEnum.siret,
                      autoComplete: 'off',
                      defaultValue: entity.siret ?? '',
                    }}
                  />
                  <Input
                    label="Numéro DD(ec)PP"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                      name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                      autoComplete: 'off',
                      defaultValue: entity.numero_ddecpp ?? '',
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
                    }}
                  />

                  <div className="flex flex-col md:flex-row w-full gap-x-4">
                    <Input
                      label="Code postal"
                      hintText="Format attendu : 5 chiffres"
                      className="shrink-0 md:basis-1/5"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.code_postal,
                        name: Prisma.EntityScalarFieldEnum.code_postal,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: entity.code_postal ?? '',
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
                  potentialUsers={usersWithEntityType}
                  relation={EntityRelationType.WORKING_FOR}
                  fetcherKey="working-for"
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'Utilisateurs pouvant envoyer des fiches à cette entité' && (
                <UserWorkingWithOrFor
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  potentialUsers={potentialPartenaires}
                  relation={EntityRelationType.WORKING_WITH}
                  fetcherKey="working-with"
                  setIsSaving={setIsSaving}
                />
              )}
              {selectedTabId === 'Collecteur Pro associé' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.COLLECTEUR_PRO}
                  description="Si une fiche est envoyée à cet ETG, un Collecteur Pro associé sera aussi en capacité de la traiter"
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
                  description="Un utilisateur d'un ETG ne peut envoyer des fiches qu'à un SVI listé ci-dessous"
                  setIsSaving={setIsSaving}
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
  adminEntityResponse: State;
  setAdminEntityResponse: (state: State) => void;
  relation: EntityRelationType;
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
  relation,
  potentialUsers,
  fetcherKey,
  setIsSaving,
}: WorkingWithOrForProps) {
  const { entity } = adminEntityResponse;

  return (
    <>
      {entity.EntityRelationsWithUsers.filter((entity) => entity.relation === relation).map(
        (entityRelation) => {
          const owner = entityRelation.UserRelatedWithEntity;
          return (
            <Notice
              key={owner.id}
              className="mb-4 fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
              style={{
                boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
              }}
              isClosable
              onClose={() => {
                setIsSaving(true);
                fetch(`${import.meta.env.VITE_API_URL}/user/user-entity/${owner.id}`, {
                  method: 'POST',
                  credentials: 'include',
                  body: JSON.stringify({
                    _action: 'delete',
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: owner.id,
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
                      if (response.data) setAdminEntityResponse(response.data!);
                    });
                  })
                  .finally(() => {
                    setIsSaving(false);
                  });
              }}
              title={
                <Link
                  to={`/app/tableau-de-bord/admin/user/${owner.id}`}
                  className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                >
                  {owner.prenom} {owner.nom_de_famille}
                  <br />
                  {owner.email}
                  <br />
                  {owner.roles.join(', ')}
                  <br />
                  {owner.code_postal} {owner.ville}
                </Link>
              }
            />
          );
        },
      )}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
        <Table
          fixed
          noCaption
          className="[&_td]:h-px"
          data={potentialUsers.map((user) => [
            <form
              key={user.id}
              id={fetcherKey}
              className="flex w-full flex-col items-start gap-4"
              method="POST"
              onSubmit={(event) => {
                event.preventDefault();
                setIsSaving(true);
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
                to={`/app/tableau-de-bord/admin/user/${user.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
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
              className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
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
  const {
    entity,
    collecteursRelatedToETG,
    etgsRelatedWithEntity,
    svisRelatedToETG,
    potentialCollecteursRelatedToETG,
    potentialEtgsRelatedWithEntity,
    potentialSvisRelatedToETG,
  } = adminEntityResponse;

  const entitiesRelated = useMemo(() => {
    switch (entityType) {
      case EntityTypes.COLLECTEUR_PRO:
        return collecteursRelatedToETG;
      case EntityTypes.ETG:
        return etgsRelatedWithEntity;
      case EntityTypes.SVI:
        return svisRelatedToETG;
      default:
        return [];
    }
  }, [collecteursRelatedToETG, entityType, etgsRelatedWithEntity, svisRelatedToETG]);

  const potentialEntitiesRelated = useMemo(() => {
    switch (entityType) {
      case EntityTypes.COLLECTEUR_PRO:
        return potentialCollecteursRelatedToETG;
      case EntityTypes.ETG:
        return potentialEtgsRelatedWithEntity;
      case EntityTypes.SVI:
        return potentialSvisRelatedToETG;
      default:
        return [];
    }
  }, [
    potentialCollecteursRelatedToETG,
    entityType,
    potentialEtgsRelatedWithEntity,
    potentialSvisRelatedToETG,
  ]);

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
        const otherEntity = entity.type === EntityTypes.ETG ? coupledEntity : entity;
        return (
          <Notice
            key={coupledEntity.id}
            className="mb-4 fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
            style={{
              boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
            }}
            isClosable
            onClose={() => {
              setIsSaving(true);
              fetch(`${import.meta.env.VITE_API_URL}/admin/entity/${entity.id}`, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                  _action: 'remove-etg-relation',
                  etg_id_entity_id: `${etg.id}_${otherEntity.id}`,
                }),
                headers: new Headers({
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                }),
              })
                .then((res) => res.json())
                .then(() => {
                  loadData(entity.id).then((response) => {
                    if (response.data) setAdminEntityResponse(response.data!);
                  });
                })
                .finally(() => {
                  setIsSaving(false);
                });
            }}
            title={
              <Link
                to={`/app/tableau-de-bord/admin/entity/${coupledEntity.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
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
        <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
          <Table
            fixed
            noCaption
            className="[&_td]:h-px"
            data={potentialEntitiesRelated.map((potentialEntityRelated) => {
              const etg = entity.type === EntityTypes.ETG ? entity : potentialEntityRelated;
              const otherEntity = entity.type === EntityTypes.ETG ? potentialEntityRelated : entity;
              return [
                <form
                  key={potentialEntityRelated.id}
                  id={`potentiel-couple-form-${potentialEntityRelated.id}`}
                  className="flex w-full flex-col items-start gap-4"
                  method="POST"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setIsSaving(true);
                    fetch(`${import.meta.env.VITE_API_URL}/admin/entity/${entity.id}`, {
                      method: 'POST',
                      credentials: 'include',
                      body: JSON.stringify({
                        _action: 'add-etg-relation',
                        etg_id_entity_id: `${etg.id}_${otherEntity.id}`,
                        etg_id: etg.id,
                        entity_id: otherEntity.id,
                        entity_type: otherEntity.type,
                      }),
                      headers: new Headers({
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                      }),
                    })
                      .then((res) => res.json())
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
                    to={`/app/tableau-de-bord/admin/entity/${otherEntity.id}`}
                    className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
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
                  to={`/app/tableau-de-bord/admin/entity/${potentialEntityRelated.id}`}
                  className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                >
                  {potentialEntityRelated.nom_d_usage}
                  {potentialEntityRelated.numero_ddecpp}
                </Link>,
                <Link
                  key={potentialEntityRelated.id}
                  to={`/app/tableau-de-bord/admin/entity/${potentialEntityRelated.id}`}
                  className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
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
