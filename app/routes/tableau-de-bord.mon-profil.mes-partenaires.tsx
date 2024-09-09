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
import { EntityTypes, RelationType, type Entity } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: RelationType.WORKING_WITH,
    },
  });

  const allEntitiesIds: Record<Entity["id"], Entity> = {};
  const allEntitiesByTypeAndId: Record<EntityTypes, Record<Entity["id"], Entity>> = Object.values(EntityTypes).reduce(
    (acc, type) => {
      acc[type] = {};
      return acc;
    },
    {} as Record<EntityTypes, Record<Entity["id"], Entity>>
  );
  for (const entity of allEntities) {
    allEntitiesIds[entity.id] = entity;
    allEntitiesByTypeAndId[entity.type][entity.id] = entity;
  }
  const userAllEntitiesIds: Record<string, Entity> = {};
  const userEntitiesByTypeAndId: Record<EntityTypes, Record<Entity["id"], Entity>> = Object.values(EntityTypes).reduce(
    (acc, type) => {
      acc[type] = {};
      return acc;
    },
    {} as Record<EntityTypes, Record<Entity["id"], Entity>>
  );
  for (const relation of userEntitiesRelations) {
    userAllEntitiesIds[relation.entity_id] = allEntitiesIds[relation.entity_id];
    userEntitiesByTypeAndId[allEntitiesIds[relation.entity_id].type][relation.entity_id] =
      allEntitiesIds[relation.entity_id];
  }

  return json({
    user,
    allEntitiesByTypeAndId,
    userEntitiesByTypeAndId,
  });
}

export default function TableauDeBord() {
  return (
    <main role="main" id="content">
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10">
            <div className="fr-background-alt--blue-france p-4 md:p-16 pb-32 md:pb-0">
              <Stepper currentStep={3} stepCount={4} title="Vos partenaires" nextTitle="Vos notifications" />
              <h1 className="fr-h2 fr-mb-2w">Renseignez vos partenaires</h1>
              <CallOut iconId="ri-mouse-line" title="Envoyez les FEI en un clic">
                Avec qui travaillez-vous ? <br />
                On pourra ainsi vous préremplir lorsqu'il s'agira de transmettre une FEI.
              </CallOut>
              <AccordionEntreprise
                fetcherKey="onboarding-etape-2-centre-collecte-data"
                accordionLabel="Vos Exploitants de Centre de Collecte"
                addLabel="Ajouter un Centre de Collecte"
                selectLabel="Sélectionnez un Centre de Collecte"
                entityType={EntityTypes.EXPLOITANT_CENTRE_COLLECTE}
              />
              <AccordionEntreprise
                fetcherKey="onboarding-etape-2-collecteur-pro-data"
                accordionLabel="Vos Collecteurs Professionnel"
                addLabel="Ajouter un Collecteur Professionnel"
                selectLabel="Sélectionnez un Collecteur Professionnel"
                entityType={EntityTypes.COLLECTEUR_PRO}
              />
              <AccordionEntreprise
                fetcherKey="onboarding-etape-2-etg-data"
                accordionLabel="Vos Établissements de Transformation des Gibiers (ETG)"
                addLabel="Ajouter un ETG"
                selectLabel="Sélectionnez un ETG"
                entityType={EntityTypes.ETG}
              />
              <AccordionEntreprise
                fetcherKey="onboarding-etape-2-svi-data"
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
              <div className="fixed md:relative bottom-0 left-0 w-full p-6 bg-white md:bg-transparent drop-shadow-xl z-50">
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
    </main>
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
                className="fr-fieldset__element [&_p.fr-notice\_\_title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
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
        id="user_centre_collecte_form"
        className="fr-fieldset__element flex flex-row items-end gap-4 w-full"
        method="POST"
        action={`/action/user-entity/${user.id}`}
        preventScrollReset
      >
        <input type="hidden" name="owner_id" value={user.id} />
        <input type="hidden" name="_action" value="create" />
        <input type="hidden" name="relation" value={RelationType.WORKING_WITH} />
        <Select
          label={addLabel}
          hint={selectLabel}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "entity_id",
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

function NumberTag({ number }: { number: number }) {
  if (number) {
    return (
      <Tag
        // iconId="fr-icon-checkbox-circle-line"
        pressed
        className="shrink-0 fr-background-action-high--blue-france fr-text-inverted--blue-france"
      >
        {number}
      </Tag>
    );
  }
  return null;
}
