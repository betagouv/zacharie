import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { EntityTypes, EntityRelationType, UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
  sortUsersByRoleAndId,
  sortUsersRelationsByRoleAndId,
  type AllowedRoles,
} from "~/utils/sort-things-by-type-and-id";

export function meta() {
  return [
    {
      title: "Mes partenaires | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_WITH,
    },
  });
  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
  });
  const allUsers = await prisma.user.findMany({
    where: {
      roles: {
        hasSome: [UserRoles.PREMIER_DETENTEUR, UserRoles.EXAMINATEUR_INITIAL],
      },
      id: {
        not: user.id,
      },
    },
    select: {
      prenom: true,
      nom_de_famille: true,
      id: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
  const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(userEntitiesRelations, allEntitiesIds);

  const [allUsersIds, allUsersByRole] = sortUsersByRoleAndId(allUsers);
  const userRelatedUsersByRoleAndId = sortUsersRelationsByRoleAndId(userRelationsWithOtherUsers, allUsersIds);

  return json({
    user,
    allUsersByRole,
    userRelatedUsersByRoleAndId,
    allEntitiesByTypeAndId,
    userEntitiesByTypeAndId,
  });
}

export default function MesPartenaires() {
  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={3} stepCount={4} title="Vos partenaires" nextTitle="Vos notifications" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos partenaires</h1>
          <CallOut title="🖱️ Envoyez les FEI en un clic" className="bg-white">
            Avec qui travaillez-vous ? <br />
            On pourra ainsi vous préremplir lorsqu'il s'agira de transmettre une FEI.
          </CallOut>
          <div className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 pb-32 md:pb-0">
              <p className="fr-text--regular mb-4">Sélectionez vos différents partenaires</p>
              {/* <AccordionUser
                fetcherKey="mes-partenaires-detenteur-initial-data"
                accordionLabel="Vos Premiers Détenteurs"
                addLabel="Ajouter un Premier Détenteur"
                selectLabel="Sélectionnez un Premier Détenteur"
                userType={UserRoles.PREMIER_DETENTEUR}
              />
              <AccordionUser
                fetcherKey="mes-partenaires-examinateur-initial-data"
                accordionLabel="Vos Examinateurs Initiaux"
                addLabel="Ajouter un Examinateur Initial"
                selectLabel="Sélectionnez un Examinateur Initial"
                userType={UserRoles.EXAMINATEUR_INITIAL}
              /> */}
              <AccordionEntreprise
                fetcherKey="mes-partenaires-centre-collecte-data"
                accordionLabel="Vos Centre de Collecte de Gibier (CCG)"
                addLabel="Ajouter un CCG"
                selectLabel="Sélectionnez un CCG"
                entityType={EntityTypes.CCG}
              />
              <AccordionEntreprise
                fetcherKey="mes-partenaires-collecteur-pro-data"
                accordionLabel="Vos Collecteurs Professionnel"
                addLabel="Ajouter un Collecteur Professionnel"
                selectLabel="Sélectionnez un Collecteur Professionnel"
                entityType={EntityTypes.COLLECTEUR_PRO}
              />
              <AccordionEntreprise
                fetcherKey="mes-partenaires-etg-data"
                accordionLabel="Vos Établissements de Transformation des Gibiers (ETG)"
                addLabel="Ajouter un ETG"
                selectLabel="Sélectionnez un ETG"
                entityType={EntityTypes.ETG}
              />
              <AccordionEntreprise
                fetcherKey="mes-partenaires-svi-data"
                accordionLabel="Vos Services Vétérinaire d'Inspection (SVI)"
                addLabel="Ajouter un SVI"
                selectLabel="Sélectionnez un SVI"
                entityType={EntityTypes.SVI}
              />
              <div className="mt-6 ml-6 mb-16">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed md:relative bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Continuer",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-notifications",
                      href: "#",
                    },
                  },
                  {
                    children: "Précédent",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-informations",
                      href: "#",
                    },
                    priority: "secondary",
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

interface AccordionEntrepriseProps {
  entityType: EntityTypes;
  addLabel: string;
  selectLabel: string;
  accordionLabel: string;
  fetcherKey: string;
}

function AccordionEntreprise({
  entityType,
  addLabel,
  selectLabel,
  accordionLabel,
  fetcherKey,
}: AccordionEntrepriseProps) {
  const { user, allEntitiesByTypeAndId, userEntitiesByTypeAndId } = useLoaderData<typeof loader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[entityType]).filter(
    (entity) => !userEntitiesByTypeAndId[entityType][entity.id]
  );

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!userEntities.length}
      label={
        <div className="inline-flex items-center justify-between md:justify-start w-full gap-4">
          {accordionLabel}
          <NumberTag number={userEntities.length} />
        </div>
      }
    >
      {userEntities
        .filter((entity) => entity.type === entityType)
        .map((entity) => {
          return (
            <div key={entity.id} className="fr-fieldset__element">
              <Notice
                className="fr-fieldset__element [&_p.fr-notice__title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
                style={{
                  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
                }}
                isClosable
                onClose={() => {
                  userEntityFetcher.submit(
                    {
                      owner_id: user.id,
                      entity_id: entity.id,
                      _action: "delete",
                    },
                    {
                      method: "POST",
                      action: `/action/user-entity/${user.id}`,
                      preventScrollReset: true,
                    }
                  );
                }}
                title={
                  <>
                    {entity.raison_sociale}
                    <br />
                    {entity.code_postal} {entity.ville}
                  </>
                }
              />
            </div>
          );
        })}
      <userEntityFetcher.Form
        id={fetcherKey}
        className="fr-fieldset__element flex flex-row items-end gap-4 w-full"
        method="POST"
        action={`/action/user-entity/${user.id}`}
        preventScrollReset
      >
        <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
        <input type="hidden" name="_action" value="create" />
        <input
          type="hidden"
          name={Prisma.EntityRelationsScalarFieldEnum.relation}
          value={EntityRelationType.WORKING_WITH}
        />
        <Select
          label={addLabel}
          hint={selectLabel}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: Prisma.EntityRelationsScalarFieldEnum.entity_id,
          }}
        >
          <option value="">{selectLabel}</option>
          {remainingEntities.map((entity) => {
            return (
              <option key={entity.id} value={entity.id}>
                {entity.raison_sociale} - {entity.code_postal} {entity.ville}
              </option>
            );
          })}
        </Select>
        <Button type="submit" disabled={!remainingEntities.length}>
          Ajouter
        </Button>
      </userEntityFetcher.Form>
    </Accordion>
  );
}

interface AccordionUserProps {
  userType: AllowedRoles;
  addLabel: string;
  selectLabel: string;
  accordionLabel: string;
  fetcherKey: string;
}

function AccordionUser({ userType, addLabel, selectLabel, accordionLabel, fetcherKey }: AccordionUserProps) {
  const { user, allUsersByRole, userRelatedUsersByRoleAndId } = useLoaderData<typeof loader>();

  const userRelationsFetcher = useFetcher({ key: fetcherKey });
  const usersRelatedUsers = Object.values(userRelatedUsersByRoleAndId[userType]);
  const remainingUsers = Object.values(allUsersByRole[userType]).filter(
    (entity) => !userRelatedUsersByRoleAndId[userType][entity.id]
  );

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!usersRelatedUsers.length}
      label={
        <div className="inline-flex items-center justify-between md:justify-start w-full gap-4">
          {accordionLabel}
          <NumberTag number={usersRelatedUsers.length} />
        </div>
      }
    >
      {usersRelatedUsers.map((relatedUser) => {
        return (
          <div key={relatedUser.id} className="fr-fieldset__element">
            <Notice
              className="fr-fieldset__element [&_p.fr-notice__title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
              style={{
                boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
              }}
              isClosable
              onClose={() => {
                userRelationsFetcher.submit(
                  {
                    owner_id: user.id,
                    related_id: relatedUser.id,
                    relation: userType,
                    _action: "delete",
                  },
                  {
                    method: "POST",
                    action: `/action/user-relation/${user.id}`,
                    preventScrollReset: true,
                  }
                );
              }}
              title={
                <>
                  {relatedUser.prenom} {relatedUser.nom_de_famille}
                  <br />
                  {relatedUser.code_postal} {relatedUser.ville}
                </>
              }
            />
          </div>
        );
      })}
      <userRelationsFetcher.Form
        id={fetcherKey}
        className="fr-fieldset__element flex flex-row items-end gap-4 w-full"
        method="POST"
        action={`/action/user-relation/${user.id}`}
        preventScrollReset
      >
        <input type="hidden" name={Prisma.UserRelationsScalarFieldEnum.owner_id} value={user.id} />
        <input type="hidden" name="_action" value="create" />
        <input type="hidden" name={Prisma.UserRelationsScalarFieldEnum.relation} value={userType} />
        <Select
          label={addLabel}
          hint={selectLabel}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: Prisma.UserRelationsScalarFieldEnum.related_id,
          }}
        >
          <option value="">{selectLabel}</option>
          {remainingUsers.map((relatedUser) => {
            return (
              <option key={relatedUser.id} value={relatedUser.id}>
                {relatedUser.prenom} {relatedUser.nom_de_famille} - {relatedUser.code_postal} {relatedUser.ville}
              </option>
            );
          })}
        </Select>
        <Button type="submit" disabled={!remainingUsers.length}>
          Ajouter
        </Button>
      </userRelationsFetcher.Form>
    </Accordion>
  );
}

function NumberTag({ number }: { number: number }) {
  if (number) {
    return (
      <Tag pressed className="shrink-0 fr-background-action-high--blue-france fr-text-inverted--blue-france">
        {number}
      </Tag>
    );
  }
  return null;
}
