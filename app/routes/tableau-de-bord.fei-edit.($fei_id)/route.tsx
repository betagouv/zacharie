import { useCallback, useEffect, useState } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { EntityTypes, RelationType, UserRoles, type Entity } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import FEIDetenteurInitial from "./detenteur-initial";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: RelationType.WORKING_FOR,
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

  if (!params.fei_id) {
    return json({
      user,
      userEntitiesByTypeAndId,
      fei: null,
      feiSteps: null,
    });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      id: Number(params.fei_id),
    },
    include: {
      SuiviFei: true,
    },
  });
  if (!fei) throw redirect("/tableau-de-bord");
  const feiSteps = {
    detenteur_initial: Boolean(fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.DETENTEUR_INITIAL)),
    examinateur_initial: Boolean(
      fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.EXAMINATEUR_INITIAL)
    ),
    centre_collecte: Boolean(
      fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.EXPLOITANT_CENTRE_COLLECTE)
    ),
    collecteur_pro: Boolean(fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.COLLECTEUR_PRO)),
    etg: Boolean(fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.ETG)),
    svi: Boolean(fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.SVI)),
  };
  return json({
    user,
    userEntitiesByTypeAndId,
    fei,
    feiSteps,
  });
}

export default function NouvelleFEI() {
  const { user, fei, feiSteps } = useLoaderData<typeof loader>();

  const feiFetcher = useFetcher({ key: "onboarding-etape-2-user-data" });
  const handleUserFormBlur = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      feiFetcher.submit(formData, {
        method: "POST",
        action: `/action/user/${user.id}`,
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    },
    [feiFetcher, user.id]
  );

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle="Vos partenaires" stepCount={4} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Nouvelle FEI</h1>
          <CallOut title="📮 N'oubliez-pas d'assigner la FEI une fois remplie !" className="bg-white">
            Zacharie se chargera de notifier les personnes concernées.
          </CallOut>
          <div className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 pb-32 md:pb-0">
              <p className="fr-text--regular mb-4">Renseignez les informations de chacun de vos rôles</p>
              <feiFetcher.Form
                id="fei_data_form"
                method="POST"
                action={`/action/fei/${fei?.id}`}
                onBlur={handleUserFormBlur}
                preventScrollReset
              >
                <Accordion
                  titleAs="h2"
                  defaultExpanded={!feiSteps?.detenteur_initial}
                  label={
                    <div className="inline-flex items-center justify-start w-full">
                      <CompletedTag done={!!feiSteps?.detenteur_initial} /> <span>Détenteur initial</span>
                    </div>
                  }
                >
                  <FEIDetenteurInitial />
                </Accordion>
              </feiFetcher.Form>
              <div className="mt-6 ml-6 mb-16">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            {/* <div className="fixed md:relative md:mt-16 bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white"> */}
            <div className="relative md:relative md:mt-16 bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Enregistrer",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-partenaires",
                      href: "#",
                    },
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
  done: boolean;
  entityType: EntityTypes;
  addLabel: string;
  selectLabel: string;
  accordionLabel: string;
  fetcherKey: string;
}

function AccordionEntreprise({
  done,
  entityType,
  addLabel,
  selectLabel,
  accordionLabel,
  fetcherKey,
}: AccordionEntrepriseProps) {
  const { user, userEntitiesByTypeAndId } = useLoaderData<typeof loader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!done}
      label={
        <div className="inline-flex items-center justify-start w-full">
          <CompletedTag done={done} /> {accordionLabel}
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
        <input type="hidden" name="relation" value={RelationType.WORKING_FOR} />
        <Select
          label={addLabel}
          hint={selectLabel}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "entity_id",
          }}
        >
          <option value="">{selectLabel}</option>
          {userEntities.map((entity) => {
            return (
              <option key={entity.id} value={entity.id}>
                {entity.raison_sociale} - {entity.code_postal} {entity.ville}
              </option>
            );
          })}
        </Select>
        <Button type="submit" disabled={!userEntities.length}>
          Ajouter
        </Button>
      </userEntityFetcher.Form>
    </Accordion>
  );
}

function CompletedTag({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="mr-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
        ✅
      </span>
    );
  }
  return (
    <span className="shrink-0 mr-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
      ❓
    </span>
  );
}
