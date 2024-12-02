import { useState, useRef, Fragment, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { EntityRelationType, EntityTypes, UserRoles, Prisma } from '@prisma/client';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import InputVille from '@app/components/InputVille';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type { AdminGetEntityResponse, AdminActionEntityData } from '@api/src/types/responses';
import type { EntityForAdmin } from '@api/src/types/entity';

const loadData = (entityId: string): Promise<AdminGetEntityResponse> =>
  fetch(`${import.meta.env.VITE_API_URL}/admin/entite/${entityId}`, {
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
    EntityRelatedWithUser: [],
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
      tabId: 'Salariés / Propriétaires / Dirigeants',
      label: `Salariés / Propriétaires / Dirigeants (${entity.EntityRelatedWithUser.filter((rel) => rel.relation === EntityRelationType.WORKING_FOR).length})`,
    },
    {
      tabId: 'Utilisateurs Partenaires',
      label: `Utilisateurs Partenaires (${entity.EntityRelatedWithUser.filter((rel) => rel.relation === EntityRelationType.WORKING_WITH).length})`,
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
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {entity.nom_d_usage} ({entity.type}) | Admin | Zacharie | Ministère de l'Agriculture
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
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
                  onBlur={(event) => {
                    event.preventDefault();
                    const formData = new FormData(formRef.current!);
                    fetch(`${import.meta.env.VITE_API_URL}/admin/entite/${params.entityId}`, {
                      method: 'POST',
                      credentials: 'include',
                      body: JSON.stringify(Object.fromEntries(formData)),
                      headers: new Headers({
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                      }),
                    })
                      .then((res) => res.json())
                      .then((res) => res as AdminActionEntityData)
                      .then(() => {
                        loadData(params.entityId!).then((response) => {
                          if (response.data) setAdminEntityResponse(response.data!);
                        });
                      });
                  }}
                >
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="SIRET"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.siret,
                        name: Prisma.EntityScalarFieldEnum.siret,
                        autoComplete: 'off',
                        defaultValue: entity.siret ?? '',
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Numéro DD(ec)PP"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        autoComplete: 'off',
                        defaultValue: entity.numero_ddecpp ?? '',
                      }}
                    />
                  </div>
                  {/* <div className="fr-fieldset__element">
                    <Input
                      label="Téléphone"
                      hintText="Format attendu : 01 22 33 44 55"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.,
                        name: Prisma.EntityScalarFieldEnum.telephone,
                        autoComplete: "off",
                        defaultValue: entity.telephone ?? "",
                      }}
                    />
                  </div> */}
                  <div className="fr-fieldset__element">
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
                  </div>
                  <div className="fr-fieldset__element">
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
                  </div>

                  <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
                    <Input
                      label="Code postal"
                      hintText="Format attendu : 5 chiffres"
                      className="shrink-0"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.code_postal,
                        name: Prisma.EntityScalarFieldEnum.code_postal,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: entity.code_postal ?? '',
                      }}
                    />
                    <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
                      <InputVille
                        postCode={entity.code_postal ?? ''}
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
                </form>
              )}
              {selectedTabId === 'Salariés / Propriétaires / Dirigeants' && (
                <UserWorkingWithOrFor
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  potentialUsers={usersWithEntityType}
                  relation={EntityRelationType.WORKING_FOR}
                  fetcherKey="working-for"
                />
              )}
              {selectedTabId === 'Utilisateurs Partenaires' && (
                <UserWorkingWithOrFor
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  potentialUsers={potentialPartenaires}
                  relation={EntityRelationType.WORKING_WITH}
                  fetcherKey="working-with"
                />
              )}
              {selectedTabId === 'Collecteur Pro associé' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.COLLECTEUR_PRO}
                />
              )}
              {selectedTabId === 'ETGs associés' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.ETG}
                />
              )}
              {selectedTabId === 'SVI associé' && (
                <EntitiesRelatedTo
                  adminEntityResponse={adminEntityResponse}
                  setAdminEntityResponse={setAdminEntityResponse}
                  entityType={EntityTypes.SVI}
                />
              )}
              <div className="mb-16 ml-6 mt-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
              <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: 'Rafraichir',
                      type: 'submit',
                      nativeButtonProps: {
                        form: 'entity_data_form',
                      },
                    },
                  ]}
                />
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
}

function UserWorkingWithOrFor({
  adminEntityResponse,
  setAdminEntityResponse,
  relation,
  potentialUsers,
  fetcherKey,
}: WorkingWithOrForProps) {
  const { entity } = adminEntityResponse;

  return (
    <>
      {entity.EntityRelatedWithUser.filter(
        (entity: State['entity']['EntityRelatedWithUser']) => entity.relation === relation,
      ).map((entityRelation: State['entity']['EntityRelatedWithUser']) => {
        const owner = entityRelation.EntityRelatedWithUser;
        return (
          <div key={owner.id} className="fr-fieldset__element">
            <Notice
              className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
              style={{
                boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
              }}
              isClosable
              onClose={() => {
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
                  });
              }}
              title={
                <Link
                  to={`/app/tableau-de-bord/admin/utilisateur/${owner.id}`}
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
          </div>
        );
      })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
        <Table
          fixed
          noCaption
          className="[&_td]:h-px"
          data={potentialUsers.map((user) => [
            <form
              key={user.id}
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
                    loadData(entity.id).then((response) => {
                      if (response.data) setAdminEntityResponse(response.data!);
                    });
                  });
              }}
            >
              <Link
                to={`/app/tableau-de-bord/admin/utilisateur/${user.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
              >
                {user.prenom} {user.nom_de_famille}
                <br />＠ {user.email}
                <br />
                🏡 {user.code_postal} {user.ville}
              </Link>
              <Button type="submit">Ajouter</Button>
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
}: {
  entityType: EntityTypes;
  adminEntityResponse: State;
  setAdminEntityResponse: (state: State) => void;
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
      {entitiesRelated.map((coupledEntity) => {
        const etg = entity.type === EntityTypes.ETG ? entity : coupledEntity;
        const otherEntity = entity.type === EntityTypes.ETG ? coupledEntity : entity;
        return (
          <div className="fr-fieldset__element" key={coupledEntity.id}>
            <Notice
              className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
              style={{
                boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
              }}
              isClosable
              onClose={() => {
                fetch(`${import.meta.env.VITE_API_URL}/admin/entite/${entity.id}`, {
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
                  });
              }}
              title={
                <Link
                  to={`/app/tableau-de-bord/admin/entite/${coupledEntity.id}`}
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
          </div>
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
                  className="fr-fieldset__element flex w-full flex-col items-start gap-4"
                  method="POST"
                  onSubmit={(event) => {
                    event.preventDefault();
                    fetch(`${import.meta.env.VITE_API_URL}/admin/entite/${entity.id}`, {
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
                      });
                  }}
                >
                  <Link
                    to={`/app/tableau-de-bord/admin/entite/${otherEntity.id}`}
                    className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                  >
                    {potentialEntityRelated.type}
                    <br />
                    {potentialEntityRelated.nom_d_usage}
                  </Link>
                  <Button
                    type="submit"
                    nativeButtonProps={{
                      form: `potentiel-couple-form-${potentialEntityRelated.id}`,
                    }}
                  >
                    Lier
                  </Button>
                </form>,
                <Link
                  key={potentialEntityRelated.id}
                  to={`/app/tableau-de-bord/admin/entite/${potentialEntityRelated.id}`}
                  className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                >
                  {potentialEntityRelated.nom_d_usage}
                  {potentialEntityRelated.numero_ddecpp}
                </Link>,
                <Link
                  key={potentialEntityRelated.id}
                  to={`/app/tableau-de-bord/admin/entite/${potentialEntityRelated.id}`}
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
