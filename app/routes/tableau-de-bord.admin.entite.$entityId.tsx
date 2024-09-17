import { useState, useCallback, useRef, Fragment } from "react";
import { ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { EntityRelationType, UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import InputVille from "~/components/InputVille";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Table } from "@codegouvfr/react-dsfr/Table";

export function meta() {
  return [
    {
      title: "Entité | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }

  const formData = await request.formData();
  console.log("formData", Object.fromEntries(formData));

  const updatedEntity = await prisma.entity.update({
    where: {
      id: params.entityId,
    },
    data: {
      raison_sociale: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
      address_ligne_1: formData.get(Prisma.EntityScalarFieldEnum.address_ligne_1) as string,
      address_ligne_2: formData.get(Prisma.EntityScalarFieldEnum.address_ligne_2) as string,
      code_postal: formData.get(Prisma.EntityScalarFieldEnum.code_postal) as string,
      ville: formData.get(Prisma.EntityScalarFieldEnum.ville) as string,
      siret: formData.get(Prisma.EntityScalarFieldEnum.siret) as string,
      numero_ddecpp: formData.get(Prisma.EntityScalarFieldEnum.numero_ddecpp) as string,
    },
  });

  return json({ ok: true, data: updatedEntity });
}
export async function loader({ request, params }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  const entity = await prisma.entity.findUnique({
    where: {
      id: params.entityId,
    },
    include: {
      EntityRelatedWithUser: {
        select: {
          relation: true,
          UserRelatedWithEntity: {
            select: {
              id: true,
              email: true,
              nom_de_famille: true,
              prenom: true,
              code_postal: true,
              ville: true,
              roles: true,
            },
          },
        },
      },
    },
  });
  if (!entity) {
    throw redirect("/tableau-de-bord/admin/entites");
  }

  const usersWithEntityType = await prisma.user.findMany({
    where: {
      roles: {
        has: entity.type,
      },
      id: {
        notIn: entity.EntityRelatedWithUser.filter(
          (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_FOR,
        ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
      },
    },
    select: {
      id: true,
      email: true,
      nom_de_famille: true,
      prenom: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  const potentialPartenaires = await prisma.user.findMany({
    where: {
      id: {
        notIn: entity.EntityRelatedWithUser.filter(
          (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_WITH,
        ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
      },
    },
    select: {
      id: true,
      email: true,
      nom_de_famille: true,
      prenom: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  return json({
    entity,
    usersWithEntityType,
    potentialPartenaires,
  });
}

export default function AdminUser() {
  const { entity, usersWithEntityType, potentialPartenaires } = useLoaderData<typeof loader>();

  const entityFetcher = useFetcher({ key: "admin-entite" });
  const formRef = useRef<HTMLFormElement>(null);
  const handleEntityFormSubmit = useCallback(() => {
    const formData = new FormData(formRef.current!);
    entityFetcher.submit(formData, {
      method: "POST",
      action: `/tableau-de-bord/admin/entite/${entity.id}`,
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
      tabId: "Partenaires",
      label: `Partenaires (${entity.EntityRelatedWithUser.filter((rel) => rel.relation === EntityRelationType.WORKING_WITH).length})`,
    },
  ];

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
                <WorkingWithOrFor
                  potentialUsers={usersWithEntityType}
                  relation={EntityRelationType.WORKING_FOR}
                  fetcherKey="working-for"
                />
              )}
              {selectedTabId === "Partenaires" && (
                <WorkingWithOrFor
                  potentialUsers={potentialPartenaires}
                  relation={EntityRelationType.WORKING_WITH}
                  fetcherKey="working-with"
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

function WorkingWithOrFor({ relation, potentialUsers, fetcherKey }: WorkingWithOrForProps) {
  const { entity } = useLoaderData<typeof loader>();

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
                    _action: "delete",
                  },
                  {
                    method: "POST",
                    action: `/action/user-entity/${entity.id}`,
                    preventScrollReset: true,
                  },
                );
              }}
              title={
                <Link
                  to={`/tableau-de-bord/admin/utilisateur/${owner.id}`}
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
              action={`/action/user-entity/${entity.id}`}
              preventScrollReset
            >
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
              <input type="hidden" name="_action" value="create" />
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.relation} value={relation} />
              <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.entity_id} value={entity.id} />
              <Link
                to={`/tableau-de-bord/admin/utilisateur/${user.id}`}
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
