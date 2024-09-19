import { useEffect, useMemo, useRef, useState } from "react";
import { json, MetaArgs, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import { EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import FEIPremierDetenteur from "./premier-detenteur";
import FEIExaminateurInitial from "./examinateur-initial";
import ConfirmCurrentOwner from "./confirm-current-owner";
import CurrentOwner from "./current-owner";
import FeiTransfer from "./transfer-current-owner";
import FEICurrentIntermediaire from "./current-intermediaire";
// import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";

export function meta({ params }: MetaArgs) {
  return [
    {
      title: `${params.fei_numero} | Zacharie | Ministère de l'Agriculture`,
    },
  ];
}

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
      FeiCurrentEntity: true,
      FeiCurrentUser: true,
      FeiNextEntity: true,
      Carcasses: {
        orderBy: {
          numero_bracelet: "asc",
        },
      },
      FeiDetenteurInitialUser: true,
      FeiExaminateurInitialUser: true,
      FeiCreatedByUser: true,
      FeiDepotEntity: true,
      FeiEtgEntity: true,
      FeiEtgUser: true,
      FeiSviEntity: true,
      FeiSviUser: true,
      FeiIntermediaires: {
        orderBy: {
          created_at: "desc", // the lastest first
        },
        include: {
          CarcasseIntermediaire: true,
          FeiIntermediaireEntity: {
            select: {
              raison_sociale: true,
              siret: true,
              type: true,
              numero_ddecpp: true,
              address_ligne_1: true,
              address_ligne_2: true,
              code_postal: true,
              ville: true,
            },
          },
          FeiIntermediaireUser: {
            select: {
              nom_de_famille: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
        },
      },
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
  const entitiesUserIsWorkingFor = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      include: {
        EntityRelatedWithUser: true,
      },
    })
  ).map((entityRelation) => entityRelation.EntityRelatedWithUser);
  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
    include: {
      UserRelatedOfUserRelation: true,
    },
  });

  const detenteursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.PREMIER_DETENTEUR)
    .map((userRelation) => userRelation.UserRelatedOfUserRelation);
  if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
    detenteursInitiaux.unshift(user);
  }

  const examinateursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
    .map((userRelation) => userRelation.UserRelatedOfUserRelation);
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    examinateursInitiaux.unshift(user);
  }

  const ccgs = userEntitiesRelations
    .filter((entityRelation) => entityRelation.EntityRelatedWithUser.type === EntityTypes.CCG)
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
    ccgs,
    collecteursPro,
    etgs,
    svis,
    entitiesUserIsWorkingFor,
  });
}

export default function Fei() {
  const { fei, user } = useLoaderData<typeof loader>();

  const doneEmoji = "✅ ";

  const tabs: TabsProps["tabs"] = [
    {
      tabId: UserRoles.EXAMINATEUR_INITIAL,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.examinateur_initial_approbation_mise_sur_le_marche ? doneEmoji : ""}Examinateur Initial
          </span>
          <span className="inline md:hidden">
            {fei.examinateur_initial_approbation_mise_sur_le_marche ? doneEmoji : ""}Examinateur
          </span>
        </>
      ),
    },
    {
      tabId: UserRoles.PREMIER_DETENTEUR,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.premier_detenteur_date_depot_quelque_part ? doneEmoji : ""}Premier Détenteur
          </span>
          <span className="inline md:hidden">
            {fei.premier_detenteur_date_depot_quelque_part ? doneEmoji : ""}Détenteur
          </span>
        </>
      ),
    },
    { tabId: "Intermédiaires", label: <>{fei.svi_entity_id ? doneEmoji : ""}Intermédiaires</> },
    {
      tabId: UserRoles.SVI,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.svi_user_id ? doneEmoji : ""}Service Vétérinaire d'Inspection (SVI)
          </span>
          <span className="inline md:hidden">{fei.svi_user_id ? doneEmoji : ""}SVI</span>
        </>
      ),
    },
  ];

  const [selectedTabId, setSelectedTabId] = useState<(typeof tabs)[number]["tabId"]>(() => {
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      return UserRoles.PREMIER_DETENTEUR;
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      return UserRoles.EXAMINATEUR_INITIAL;
    }
    if (fei.fei_current_owner_role === UserRoles.SVI) {
      return UserRoles.SVI;
    }
    return "Intermédiaires";
  });

  const refCurrentRole = useRef(fei.fei_current_owner_role);
  const refCurrentUserId = useRef(fei.fei_current_owner_user_id);
  useEffect(() => {
    if (fei.fei_current_owner_role !== refCurrentRole.current) {
      if (fei.fei_current_owner_user_id === user.id && refCurrentUserId.current === user.id) {
        if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
          setSelectedTabId(UserRoles.PREMIER_DETENTEUR);
        }
        if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
          setSelectedTabId(UserRoles.EXAMINATEUR_INITIAL);
        }
        if (
          [UserRoles.COLLECTEUR_PRO, UserRoles.CCG, UserRoles.ETG].includes(
            // @ts-expect-error - TS doesn't know that the following roles are valid tabIds
            fei.fei_current_owner_role,
          )
        ) {
          setSelectedTabId("Intermédiaires");
        }
        if (fei.fei_current_owner_role === UserRoles.SVI) {
          setSelectedTabId(UserRoles.SVI);
        }
      }
    }
    refCurrentRole.current = fei.fei_current_owner_role;
    refCurrentUserId.current = fei.fei_current_owner_user_id;
  }, [fei.fei_current_owner_role, fei.fei_current_owner_user_id, user.id]);

  const refNextRole = useRef(fei.fei_next_owner_role);
  const refNextUserId = useRef(fei.fei_next_owner_user_id);

  useEffect(() => {
    if (fei.fei_next_owner_user_id === user.id && refNextUserId.current !== fei.fei_next_owner_user_id) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    refNextRole.current = fei.fei_next_owner_role;
    refNextUserId.current = fei.fei_next_owner_user_id;
  }, [fei.fei_next_owner_role, fei.fei_next_owner_user_id, user.id]);

  const intermediaireTabDisabled = useMemo(() => {
    const intermediaire = fei.FeiIntermediaires[0];
    if (!intermediaire) {
      return true;
    }
    return false;
  }, [fei.FeiIntermediaires]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 m-4 bg-white md:m-0 md:p-0 [&_.fr-tabs\\_\\_list]:bg-alt-blue-france">
          {/* <Breadcrumb
            currentPageLabel={fei.numero}
            className="m-0 bg-alt-blue-france pb-4 pl-2 md:pl-0"
            segments={[
              {
                label: "Mon tableau de bord",
                linkProps: {
                  href: "/tableau-de-bord",
                },
              },
            ]}
          /> */}
          <FeiTransfer />
          <ConfirmCurrentOwner />
          <CurrentOwner />
          <Tabs selectedTabId={selectedTabId} tabs={tabs} onTabChange={setSelectedTabId}>
            {selectedTabId === UserRoles.EXAMINATEUR_INITIAL && <FEIExaminateurInitial />}
            {selectedTabId === UserRoles.PREMIER_DETENTEUR && <FEIPremierDetenteur />}
            {selectedTabId === "Intermédiaires" &&
              (intermediaireTabDisabled ? (
                <p>Il n'y a pas encore de premier intermédiaire sélectionné</p>
              ) : (
                <FEICurrentIntermediaire />
              ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
