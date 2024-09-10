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
  const fei = await prisma.fei.findUnique({
    where: {
      numero: params.fei_numero,
    },
    include: {
      Carcasse: true,
      FeiDetenteurInitialUser: true,
      FeiExaminateurInitialUser: true,
      FeiCreatedByUser: true,
      FeiSviEntity: true,
      FeiSviUser: true,
      FeiIntermediaires: true,
    },
  });
  if (!fei) {
    throw redirect("/tableau-de-bord");
  }
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_WITH,
    },
    include: {
      EntityRelatedWithUser: true,
    },
  });
  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
    include: {
      UserRelatedOfUserRelation: true,
    },
  });

  const detenteursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.DETENTEUR_INITIAL)
    .map((userRelation) => userRelation.UserRelatedOfUserRelation);
  if (user.roles.includes(UserRoles.DETENTEUR_INITIAL)) {
    detenteursInitiaux.unshift(user);
  }

  const examinateursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
    .map((userRelation) => userRelation.UserRelatedOfUserRelation);
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    examinateursInitiaux.unshift(user);
  }

  const centresCollecte = userEntitiesRelations
    .filter((entityRelation) => entityRelation.EntityRelatedWithUser.type === EntityTypes.EXPLOITANT_CENTRE_COLLECTE)
    .map((entityRelation) => entityRelation.EntityRelatedWithUser);

  const collecteursPro = userEntitiesRelations
    .filter((entityRelation) => entityRelation.EntityRelatedWithUser.type === EntityTypes.COLLECTEUR_PRO)
    .map((entityRelation) => entityRelation.EntityRelatedWithUser);

  const etgs = userEntitiesRelations
    .filter((entityRelation) => entityRelation.EntityRelatedWithUser.type === EntityTypes.ETG)
    .map((entityRelation) => entityRelation.EntityRelatedWithUser);

  const svis = userEntitiesRelations
    .filter((entityRelation) => entityRelation.EntityRelatedWithUser.type === EntityTypes.SVI)
    .map((entityRelation) => entityRelation.EntityRelatedWithUser);

  return json({
    user,
    fei,
    detenteursInitiaux,
    examinateursInitiaux,
    centresCollecte,
    collecteursPro,
    etgs,
    svis,
  });
}

export default function NouvelleFEI() {
  const { user, fei } = useLoaderData<typeof loader>();

  const [feiInitRoles, setFeiInitRoles] = useState<UserRoles[]>(() => {
    if (!user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return [UserRoles.DETENTEUR_INITIAL];
    }
    if (!user.roles.includes(UserRoles.DETENTEUR_INITIAL)) {
      return [UserRoles.EXAMINATEUR_INITIAL];
    }
    return [];
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
              {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) &&
                user.roles.includes(UserRoles.DETENTEUR_INITIAL) && (
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
                )}
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
