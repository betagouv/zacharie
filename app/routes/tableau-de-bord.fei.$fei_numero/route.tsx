import { useState } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import FEIDetenteurInitial from "./detenteur-initial";
import FEIExaminateurInitial from "./examinateur-initial";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_WITH,
    },
    include: {
      Related: true,
    },
  });
  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
    include: {
      Related: true,
    },
  });

  const detenteursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.DETENTEUR_INITIAL)
    .map((userRelation) => userRelation.Related);
  if (user.roles.includes(UserRoles.DETENTEUR_INITIAL)) {
    detenteursInitiaux.unshift(user);
  }

  const examinateursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
    .map((userRelation) => userRelation.Related);
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    examinateursInitiaux.unshift(user);
  }

  const centresCollecte = userEntitiesRelations
    .filter((entityRelation) => entityRelation.Related.type === EntityTypes.EXPLOITANT_CENTRE_COLLECTE)
    .map((entityRelation) => entityRelation.Related);

  const collecteursPro = userEntitiesRelations
    .filter((entityRelation) => entityRelation.Related.type === EntityTypes.COLLECTEUR_PRO)
    .map((entityRelation) => entityRelation.Related);

  const etgs = userEntitiesRelations
    .filter((entityRelation) => entityRelation.Related.type === EntityTypes.ETG)
    .map((entityRelation) => entityRelation.Related);

  const svis = userEntitiesRelations
    .filter((entityRelation) => entityRelation.Related.type === EntityTypes.SVI)
    .map((entityRelation) => entityRelation.Related);

  if (!params.fei_id) {
    return json({
      user,
      detenteursInitiaux,
      examinateursInitiaux,
      centresCollecte,
      collecteursPro,
      etgs,
      svis,
      fei: null,
      fei_owners: null,
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
  if (!fei) {
    throw redirect("/tableau-de-bord");
  }
  const fei_owners = {
    detenteur_initial_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.DETENTEUR_INITIAL)
      ?.suivi_par_user_id,
    examinateur_initial_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.EXAMINATEUR_INITIAL)
      ?.suivi_par_user_id,
    centre_collecte_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.EXPLOITANT_CENTRE_COLLECTE)
      ?.suivi_par_user_id,
    collecteur_pro_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.COLLECTEUR_PRO)
      ?.suivi_par_user_id,
    etg_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.ETG)?.suivi_par_user_id,
    svi_id: fei.SuiviFei.find((suivi) => suivi.suivi_par_user_role === UserRoles.SVI)?.suivi_par_user_id,
  };
  return json({
    user,
    detenteursInitiaux,
    examinateursInitiaux,
    centresCollecte,
    collecteursPro,
    etgs,
    svis,
    fei,
    fei_owners,
  });
}

export default function NouvelleFEI() {
  const { user, fei, fei_owners } = useLoaderData<typeof loader>();

  const [feiInitRoles, setFeiInitRoles] = useState<UserRoles[]>(() => {
    const initRoles: UserRoles[] = [];
    if (fei_owners?.detenteur_initial_id === user.id) {
      initRoles.push(UserRoles.DETENTEUR_INITIAL);
    }
    if (fei_owners?.examinateur_initial_id === user.id) {
      initRoles.push(UserRoles.EXAMINATEUR_INITIAL);
    }
    return initRoles;
  });
  const feiFetcher = useFetcher({ key: "onboarding-etape-2-user-data" });

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
              <Checkbox
                legend="Pour cette FEI vous êtes"
                options={[
                  {
                    label: "Détenteur initial",
                    nativeInputProps: {
                      name: "fei-init-roles",
                      value: UserRoles.DETENTEUR_INITIAL,
                      defaultChecked: feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL),
                      onChange: (event) => {
                        if (event.target.checked) {
                          setFeiInitRoles((prev) => [...prev, UserRoles.DETENTEUR_INITIAL]);
                        } else {
                          setFeiInitRoles((prev) => prev.filter((role) => role !== UserRoles.DETENTEUR_INITIAL));
                        }
                      },
                    },
                  },
                  {
                    label: "Examinateur initial",
                    nativeInputProps: {
                      name: "fei-init-roles",
                      value: UserRoles.EXAMINATEUR_INITIAL,
                      defaultChecked: feiInitRoles.includes(UserRoles.EXAMINATEUR_INITIAL),
                      onChange: (event) => {
                        if (event.target.checked) {
                          setFeiInitRoles((prev) => [...prev, UserRoles.EXAMINATEUR_INITIAL]);
                        } else {
                          setFeiInitRoles((prev) => prev.filter((role) => role !== UserRoles.EXAMINATEUR_INITIAL));
                        }
                      },
                    },
                  },
                ]}
                state="default"
                stateRelatedMessage="State description"
              />
              <feiFetcher.Form
                id="fei_data_form"
                method="POST"
                action={`/action/fei/${fei?.id}`}
                // onBlur={handleUserFormBlur}
                preventScrollReset
              >
                {feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL) && (
                  <div className="mb-8">
                    <h2 className="fr-h3 fr-mb-2w">Détenteur Initial</h2>
                    <FEIDetenteurInitial feiInitRoles={feiInitRoles} />
                  </div>
                )}
                {feiInitRoles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
                  <div className="mb-8">
                    <h2 className="fr-h3 fr-mb-2w">Examinateur Initial</h2>
                    <FEIExaminateurInitial feiInitRoles={feiInitRoles} />
                  </div>
                )}
              </feiFetcher.Form>
              <div className="mt-6 ml-6 mb-16">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            {/* <div className="fixed md:relative bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none"> */}
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
        <input type="hidden" name="relation" value={EntityRelationType.WORKING_FOR} />
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
