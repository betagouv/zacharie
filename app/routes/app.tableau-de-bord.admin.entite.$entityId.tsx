import { useState, useCallback, useRef, Fragment } from "react";
import {
  json,
  redirect,
  Link,
  useFetcher,
  useLoaderData,
  type ClientLoaderFunctionArgs,
  type ClientActionFunctionArgs,
} from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { EntityRelationType, EntityTypes, UserRoles, Prisma } from "@prisma/client";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import InputVille from "~/components/InputVille";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";
import type { AdminEntityLoaderData } from "~/routes/api.admin.loader.entite.$entityId";

export function meta() {
  return [
    {
      title: "Entité | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  console.log("formdata tableau-de-bord.admin.entity.$entityId", Object.fromEntries(formData));
  const route = formData.get("route") as string;
  if (!route) {
    return json({ ok: false, data: null, error: "Route is required" }, { status: 400 });
  }
  const url = `${import.meta.env.VITE_API_URL}${route}`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json());
  return response;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const admin = await getMostFreshUser();
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/loader/entite/${params.entityId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load entity");
  }
  const data = (await response.json()) as AdminEntityLoaderData;

  return json(data);
}

export default function AdminEntity() {
  const { entity, usersWithEntityType, potentialPartenaires } = useLoaderData<typeof clientLoader>();

  const entityFetcher = useFetcher({ key: "admin-entite" });
  const formRef = useRef<HTMLFormElement>(null);
  const handleEntityFormSubmit = useCallback(() => {
    const formData = new FormData(formRef.current!);
    formData.append("route", `/admin/action/entite/${entity.id}`);
    entityFetcher.submit(formData, {
      method: "POST",
      preventScrollReset: true,
    });
  }, [entityFetcher, formRef, entity]);

  const [selectedTabId, setSelectedTabId] = useState("Raison Sociale");
  const tabs: TabsProps["tabs"] = [
    {
      tabId: "Raison Sociale",
      label: "Raison Sociale",
    },
    {
      tabId: "Salariés / Propriétaires / Dirigeants",
      label: `Salariés / Propriétaires / Dirigeants (${entity.EntityRelatedWithUser.filter((rel) => rel.relation === EntityRelationType.WORKING_FOR).length})`,
    },
    {
      tabId: "Utilisateurs Partenaires",
      label: `Utilisateurs Partenaires (${entity.EntityRelatedWithUser.filter((rel) => rel.relation === EntityRelationType.WORKING_WITH).length})`,
    },
  ];
  if (entity.type === EntityTypes.ETG) {
    tabs.push({
      tabId: "SVI Couplé",
      label: `SVI Couplé (${entity.CoupledEntity ? 1 : 0})`,
    });
  }
  if (entity.type === EntityTypes.SVI) {
    tabs.push({
      tabId: "ETG Couplé",
      label: `ETG Couplé (${entity.CoupledEntity ? 1 : 0})`,
    });
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">{entity.raison_sociale}</h1>
          <div className="p-4 pb-32 md:p-8 md:pb-0">
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="mb-6 bg-white md:shadow [&_.fr-tabs\_\_list]:!bg-alt-blue-france [&_.fr-tabs\_\_list]:!shadow-none"
            >
              {selectedTabId === "Raison Sociale" && (
                <entityFetcher.Form
                  id="entity_data_form"
                  method="POST"
                  ref={formRef}
                  onBlur={handleEntityFormSubmit}
                  preventScrollReset
                >
                  <input type="hidden" name="route" value={`/admin/action/entite/${entity.id}`} />
                  <div className="fr-fieldset__element">
                    <Input
                      label="Raison Sociale"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.raison_sociale,
                        name: Prisma.EntityScalarFieldEnum.raison_sociale,
                        autoComplete: "off",
                        required: true,
                        defaultValue: entity.raison_sociale ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="SIRET"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.siret,
                        name: Prisma.EntityScalarFieldEnum.siret,
                        autoComplete: "off",
                        defaultValue: entity.siret ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Numéro DD(ec)PP"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        autoComplete: "off",
                        defaultValue: entity.numero_ddecpp ?? "",
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
                        autoComplete: "off",
                        required: true,
                        defaultValue: entity.address_ligne_1 ?? "",
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
                        autoComplete: "off",
                        defaultValue: entity.address_ligne_2 ?? "",
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
                        autoComplete: "off",
                        required: true,
                        defaultValue: entity.code_postal ?? "",
                      }}
                    />
                    <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
                      <InputVille
                        postCode={entity.code_postal ?? ""}
                        trimPostCode
                        label="Ville ou commune"
                        hintText="Exemple : Montpellier"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.ville,
                          name: Prisma.EntityScalarFieldEnum.ville,
                          autoComplete: "off",
                          required: true,
                          defaultValue: entity.ville ?? "",
                        }}
                      />
                    </div>
                  </div>
                </entityFetcher.Form>
              )}
              {selectedTabId === "Salariés / Propriétaires / Dirigeants" && (
                <UserWorkingWithOrFor
                  potentialUsers={usersWithEntityType}
                  relation={EntityRelationType.WORKING_FOR}
                  fetcherKey="working-for"
                />
              )}
              {selectedTabId === "Utilisateurs Partenaires" && (
                <UserWorkingWithOrFor
                  potentialUsers={potentialPartenaires}
                  relation={EntityRelationType.WORKING_WITH}
                  fetcherKey="working-with"
                />
              )}
              {["SVI Couplé", "ETG Couplé"].includes(selectedTabId) && <CoupledEntity />}
              <div className="mb-16 ml-6 mt-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
              <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Rafraichir",
                      type: "submit",
                      nativeButtonProps: {
                        form: "entity_data_form",
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

function UserWorkingWithOrFor({ relation, potentialUsers, fetcherKey }: WorkingWithOrForProps) {
  const { entity } = useLoaderData<typeof clientLoader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });

  return (
    <>
      {entity.EntityRelatedWithUser.filter((entity) => entity.relation === relation).map((entityRelation) => {
        const owner = entityRelation.UserRelatedWithEntity;
        return (
          <div key={owner.id} className="fr-fieldset__element">
            <Notice
              className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
              style={{
                boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
              }}
              isClosable
              onClose={() => {
                userEntityFetcher.submit(
                  {
                    owner_id: owner.id,
                    entity_id: entity.id,
                    relation,
                    _action: "delete",
                    route: `/action/user-entity/${entity.id}`,
                  },
                  {
                    method: "POST",
                    preventScrollReset: true,
                  },
                );
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
                  {owner.roles.join(", ")}
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
            <userEntityFetcher.Form
              key={user.id}
              id={fetcherKey}
              className="fr-fieldset__element flex w-full flex-col items-start gap-4"
              method="POST"
              preventScrollReset
            >
              <input type="hidden" name="route" value={`/api/action/user-entity/${entity.id}`} />
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
              <input type="hidden" name="_action" value="create" />
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.relation} value={relation} />
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.entity_id} value={entity.id} />
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
            </userEntityFetcher.Form>,
            <p key={user.id} className="!inline-flex size-full items-center justify-start !bg-none !no-underline">
              {user.roles.map((role) => (
                <Fragment key={role}>
                  {role}
                  <br />
                </Fragment>
              ))}
            </p>,
          ])}
          headers={["Utilisateur", "Roles"]}
        />
      </div>
    </>
  );
}

function CoupledEntity() {
  const { entity, sviOrEtgPotentielCouple } = useLoaderData<typeof clientLoader>();

  const coupledEntity = entity.CoupledEntity;
  const coupledEntityFetcher = useFetcher({ key: "coupled-entity-fetcher" });

  return (
    <>
      {coupledEntity ? (
        <div className="fr-fieldset__element">
          <Notice
            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
            style={{
              boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
            }}
            isClosable
            onClose={() => {
              coupledEntityFetcher.submit(
                {
                  _action: "remove-couple",
                  route: `/admin/action/entite/${entity.id}`,
                },
                {
                  method: "POST",
                  preventScrollReset: true,
                },
              );
            }}
            title={
              <Link
                to={`/app/tableau-de-bord/admin/entite/${coupledEntity.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
              >
                {coupledEntity.raison_sociale}
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
      ) : (
        <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
          <Table
            fixed
            noCaption
            className="[&_td]:h-px"
            data={sviOrEtgPotentielCouple.map((potentielCouple) => [
              <coupledEntityFetcher.Form
                key={potentielCouple.id}
                id="potentiel-couple-form"
                className="fr-fieldset__element flex w-full flex-col items-start gap-4"
                method="POST"
                preventScrollReset
              >
                <input type="hidden" name={Prisma.EntityScalarFieldEnum.coupled_entity_id} value={potentielCouple.id} />
                <input type="hidden" name="route" value={`/admin/action/entite/${entity.id}`} />
                <Link
                  to={`/app/tableau-de-bord/admin/entite/${potentielCouple.id}`}
                  className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                >
                  {potentielCouple.type}
                  <br />
                  {potentielCouple.raison_sociale}
                </Link>
                <Button
                  type="submit"
                  nativeButtonProps={{
                    form: "potentiel-couple-form",
                  }}
                >
                  Coupler
                </Button>
              </coupledEntityFetcher.Form>,
              <Link
                key={potentielCouple.id}
                to={`/app/tableau-de-bord/admin/entite/${potentielCouple.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
              >
                {potentielCouple.siret}
                {potentielCouple.numero_ddecpp}
              </Link>,
              <Link
                key={potentielCouple.id}
                to={`/app/tableau-de-bord/admin/entite/${potentielCouple.id}`}
                className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
              >
                {potentielCouple.address_ligne_1}
                <br />
                {potentielCouple.address_ligne_2}
                <br />
                {potentielCouple.code_postal} {potentielCouple.ville}
              </Link>,
            ])}
            headers={["Entité", "Siret", "Adresse"]}
          />
        </div>
      )}
    </>
  );
}
