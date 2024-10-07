import { useEffect, useMemo, useRef, useState } from "react";
import {
  json,
  MetaArgs,
  redirect,
  useLoaderData,
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import { Prisma, UserRoles, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
import FEIPremierDetenteur from "./premier-detenteur";
import ConfirmCurrentOwner from "./confirm-current-owner";
import CurrentOwner from "./current-owner";
import FeiTransfer from "./transfer-current-owner";
import FEICurrentIntermediaire from "./current-intermediaire";
import FEI_SVI from "./svi";
import FEIExaminateurInitial from "./examinateur-initial";
import { type FeiLoaderData, type FeiActionData } from "~/routes/api.fei.$fei_numero";
import { type FeiUserLoaderData } from "~/routes/api.fei-user.$fei_numero.$user_id";
import { type FeiEntityLoaderData } from "~/routes/api.fei-entity.$fei_numero.$entity_id";
import { type CarcassesLoaderData } from "~/routes/api.fei-carcasses.$fei_numero";
import { type FeiIntermediairesLoaderData } from "~/routes/api.fei-intermediaires.$fei_numero";
import { type FeiCarcasseIntermediaireLoaderData } from "~/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet";
import { type MyRelationsLoaderData } from "~/routes/api.loader.my-relations";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";

export function meta({ params }: MetaArgs) {
  return [
    {
      title: `${params.fei_numero} | Zacharie | Ministère de l'Agriculture`,
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  console.log("fei route formdata", Object.fromEntries(formData.entries()));
  const route = formData.get("route") as string;
  if (!route) {
    return json({ ok: false, data: null, error: "Route is required" }, { status: 400 });
  }
  if (!formData.get(Prisma.FeiScalarFieldEnum.numero) && !formData.get(Prisma.CarcasseScalarFieldEnum.fei_numero)) {
    return json({ ok: false, data: null, error: "NUmero is required" }, { status: 400 });
  }
  const url = `${import.meta.env.VITE_API_URL}${route}`;
  const response = (await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as FeiActionData;
  return response;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }

  async function get(pathname: string) {
    return fetch(`${import.meta.env.VITE_API_URL}${pathname}`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    }).then((res) => res.json());
  }

  const feiData = (await get(`/api/fei/${params.fei_numero}`)) as FeiLoaderData;

  const examinateurInitialId = feiData.data?.fei.examinateur_initial_user_id;
  const examinateurInitialUser = examinateurInitialId
    ? ((await get(`/api/fei-user/${params.fei_numero}/${examinateurInitialId}`)) as FeiUserLoaderData)
    : null;

  const premierDetenteurId = feiData.data?.fei.premier_detenteur_user_id;
  const premierDetenteurUser = premierDetenteurId
    ? ((await get(`/api/fei-user/${params.fei_numero}/${premierDetenteurId}`)) as FeiUserLoaderData)
    : null;

  const depotEntityId = feiData.data?.fei.premier_detenteur_depot_entity_id;
  const premierDetenteurDepotEntityId = depotEntityId
    ? ((await get(`/api/fei-entity/${params.fei_numero}/${depotEntityId}`)) as FeiEntityLoaderData)
    : null;

  const currentOwnerId = feiData.data?.fei.fei_current_owner_user_id;
  const currentOwnerUser = currentOwnerId
    ? ((await get(`/api/fei-user/${params.fei_numero}/${currentOwnerId}`)) as FeiUserLoaderData)
    : null;

  const currentOwnerEntityId = feiData.data?.fei.fei_current_owner_entity_id;
  const currentOwnerEntity = currentOwnerEntityId
    ? ((await get(`/api/fei-entity/${params.fei_numero}/${currentOwnerEntityId}`)) as FeiEntityLoaderData)
    : null;

  const nextOwnerUserId = feiData.data?.fei.fei_next_owner_user_id;
  const nextOwnerUser = nextOwnerUserId
    ? ((await get(`/api/fei-user/${params.fei_numero}/${nextOwnerUserId}`)) as FeiUserLoaderData)
    : null;

  const nextOwnerEntityId = feiData.data?.fei.fei_next_owner_entity_id;
  const nextOwnerEntity = nextOwnerEntityId
    ? ((await get(`/api/fei-entity/${params.fei_numero}/${nextOwnerEntityId}`)) as FeiEntityLoaderData)
    : null;

  const sviUserId = feiData.data?.fei.svi_user_id;
  const sviUser = sviUserId
    ? ((await get(`/api/fei-user/${params.fei_numero}/${sviUserId}`)) as FeiUserLoaderData)
    : null;

  const sviEntityid = feiData.data?.fei.svi_entity_id;
  const svi = sviEntityid
    ? ((await get(`/api/fei-entity/${params.fei_numero}/${sviEntityid}`)) as FeiEntityLoaderData)
    : null;

  const carcasses = (await get(`/api/fei-carcasses/${params.fei_numero}`)) as CarcassesLoaderData;

  const intermediaires = (await get(`/api/fei-intermediaires/${params.fei_numero}`)) as FeiIntermediairesLoaderData;
  const inetermediairesPopulated = [];
  for (const intermediaire of intermediaires.data?.intermediaires || []) {
    const intermediaireUser = intermediaire.fei_intermediaire_user_id
      ? ((await get(
          `/api/fei-user/${params.fei_numero}/${intermediaire.fei_intermediaire_user_id}`,
        )) as FeiUserLoaderData)
      : null;
    const intermediaireEntity = intermediaire.fei_intermediaire_entity_id
      ? ((await get(
          `/api/fei-entity/${params.fei_numero}/${intermediaire.fei_intermediaire_entity_id}`,
        )) as FeiEntityLoaderData)
      : null;
    const intermediaireCarcasses: Record<Carcasse["numero_bracelet"], CarcasseIntermediaire | null> = {};
    for (const carcasse of carcasses.data?.carcasses || []) {
      const intermediaireCarcasse = (await get(
        `/api/fei-carcasse-intermediaire/${params.fei_numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
      )) as FeiCarcasseIntermediaireLoaderData;
      intermediaireCarcasses[carcasse.numero_bracelet] = intermediaireCarcasse.data?.carcasseIntermediaire || null;
    }
    inetermediairesPopulated.push({
      ...intermediaire,
      user: intermediaireUser?.data?.user,
      entity: intermediaireEntity?.data?.entity,
      carcasses: intermediaireCarcasses,
    });
  }

  const myRelationsData = (await get(`/api/loader/my-relations`)) as MyRelationsLoaderData;

  return json({
    user,
    fei: feiData.data!.fei,
    examinateurInitialUser: examinateurInitialUser?.data?.user,
    premierDetenteurUser: premierDetenteurUser?.data?.user,
    premierDetenteurDepotEntity: premierDetenteurDepotEntityId?.data?.entity,
    currentOwnerUser: currentOwnerUser?.data?.user,
    currentOwnerEntity: currentOwnerEntity?.data?.entity,
    nextOwnerUser: nextOwnerUser?.data?.user,
    nextOwnerEntity: nextOwnerEntity?.data?.entity,
    sviUser: sviUser?.data?.user,
    svi: svi?.data?.entity,
    carcasses: carcasses.data?.carcasses || [],
    inetermediairesPopulated,
    relationsCatalog: {
      detenteursInitiaux: myRelationsData.data?.detenteursInitiaux || [],
      // examinateursInitiaux: myRelationsData.data?.examinateursInitiaux || [],
      ccgs: myRelationsData.data?.ccgs || [],
      collecteursPro: myRelationsData.data?.collecteursPro || [],
      etgs: myRelationsData.data?.etgs || [],
      svis: myRelationsData.data?.svis || [],
      entitiesUserIsWorkingFor: myRelationsData.data?.entitiesUserIsWorkingFor || [],
    },
  });
}

export default function Fei() {
  const { fei, user, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();

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
      if (fei.fei_current_owner_user_id === user.id) {
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
    const intermediaire = inetermediairesPopulated?.[0];
    if (!intermediaire) {
      return true;
    }
    return false;
  }, [inetermediairesPopulated]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 m-4 bg-white md:m-0 md:p-0 [&_.fr-tabs\\_\\_list]:bg-alt-blue-france">
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
            {selectedTabId === UserRoles.SVI && <FEI_SVI />}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
