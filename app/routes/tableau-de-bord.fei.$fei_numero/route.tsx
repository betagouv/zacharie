import { useEffect, useMemo, useRef, useState } from "react";
import {
  json,
  MetaArgs,
  redirect,
  useLoaderData,
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";
import { setFeiToCache } from "~/utils/caches";
import { Tabs, type TabsProps } from "@codegouvfr/react-dsfr/Tabs";
import { UserRoles } from "@prisma/client";
import FEIPremierDetenteur from "./premier-detenteur";
import ConfirmCurrentOwner from "./confirm-current-owner";
import CurrentOwner from "./current-owner";
import FeiTransfer from "./transfer-current-owner";
import FEICurrentIntermediaire from "./current-intermediaire";
import FEI_SVI from "./svi";
import FEIExaminateurInitial from "./examinateur-initial";
import { type FeiLoaderData } from "~/routes/loader.fei.$fei_numero";
import { type FeiActionData } from "~/routes/action.fei.$fei_numero";
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
  const url = `${import.meta.env.VITE_API_URL}${route}`;
  const response = (await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as FeiActionData;
  if (response.ok && response.data?.id) {
    const fei = response.data;
    setFeiToCache(fei);
  }
  return response;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const loaderData = (await fetch(`${import.meta.env.VITE_API_URL}/loader/fei/${params.fei_numero}`, {
    method: "GET",
    credentials: "include",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
  }).then((res) => res.json())) as FeiLoaderData;

  return json({
    user,
    ...loaderData,
  });
}

export default function Fei() {
  const { fei, user } = useLoaderData<typeof clientLoader>();

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
