import { useState } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import { EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import FEIDetenteurInitial from "./detenteur-initial";
import FEIExaminateurInitial from "./examinateur-initial";
import SelectNextOwner from "./select-next-owner";

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

export default function Fei() {
  const { fei } = useLoaderData<typeof loader>();

  const tabs: TabsProps["tabs"] = [
    {
      tabId: "Détenteur Initial",
      label: (
        <>
          <span className="hidden md:inline">Détenteur Initial</span>
          <span className="inline md:hidden">Détenteur</span>
        </>
      ),
    },
    {
      tabId: "Examinateur Initial",
      label: (
        <>
          <span className="hidden md:inline">Examinateur Initial</span>
          <span className="inline md:hidden">Examinateur</span>
        </>
      ),
    },
    { tabId: "Intermédiaires", label: "Intermédiaires" },
    {
      tabId: "Service Vétérinaire d'Inspection",
      label: (
        <>
          <span className="hidden md:inline">Service Vétérinaire d'Inspection (SVI)</span>
          <span className="inline md:hidden">SVI</span>
        </>
      ),
    },
  ];
  const [selectedTabId, setSelectedTabId] = useState<(typeof tabs)[number]["tabId"]>(() => {
    if (fei.fei_current_owner_role === UserRoles.DETENTEUR_INITIAL) {
      return "Détenteur Initial";
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      return "Examinateur Initial";
    }
    if (fei.fei_current_owner_role === UserRoles.SVI) {
      return "Service Vétérinaire d'Inspection";
    }
    return "Intermédiaires";
  });
  // const feiFetcher = useFetcher({ key: "onboarding-etape-2-user-data" });

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Tabs selectedTabId={selectedTabId} tabs={tabs} onTabChange={setSelectedTabId}>
            {selectedTabId === "Examinateur Initial" && <FEIExaminateurInitial />}
            {selectedTabId === "Détenteur Initial" && <FEIDetenteurInitial />}
          </Tabs>
          <SelectNextOwner />
        </div>
      </div>
    </div>
  );
}
