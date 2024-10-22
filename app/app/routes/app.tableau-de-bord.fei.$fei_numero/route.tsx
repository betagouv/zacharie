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
import { Prisma, UserRoles } from "@prisma/client";
import FEIPremierDetenteur from "./premier-detenteur";
import ConfirmCurrentOwner from "./confirm-current-owner";
import CurrentOwner from "./current-owner";
import FeiTransfer from "./transfer-current-owner";
import FEICurrentIntermediaire from "./current-intermediaire";
import FEI_SVI from "./svi";
import FEIExaminateurInitial from "./examinateur-initial";
import { type FeiActionData } from "@api/routes/api.fei.$fei_numero";
import { getMostFreshUser } from "@app/utils-offline/get-most-fresh-user";
import { loadFei } from "@app/db/fei.client";
import { type MyRelationsLoaderData } from "@api/routes/api.loader.my-relations";

export function meta({ params }: MetaArgs) {
  return [
    {
      title: `${params.fei_numero} | Zacharie | Ministère de l'Agriculture`,
    },
  ];
}

export async function clientAction({ request, params }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  for (const key of formData.keys()) {
    if (formData.get(key) === "null") {
      formData.set(key, "");
    }
  }
  const route = formData.get("route") as string;
  if (!route) {
    console.log("Route is required");
    return json({ ok: false, data: null, error: "Route is required" }, { status: 400 });
  }
  if (!formData.get(Prisma.FeiScalarFieldEnum.numero) && !formData.get(Prisma.CarcasseScalarFieldEnum.fei_numero)) {
    console.log("NUmero is required");
    return json({ ok: false, data: null, error: "NUmero is required" }, { status: 400 });
  }
  const url = `${import.meta.env.VITE_API_URL}${route}`;
  console.log("GOGOGOG", url);
  const response = (await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as FeiActionData;
  if (params.fei_numero === "nouvelle") {
    return redirect(`/app/tableau-de-bord/fei/${response.data?.fei.numero}`);
  }
  return response;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }

  const myRelationsData = (await fetch(`${import.meta.env.VITE_API_URL}/api/loader/my-relations`, {
    method: "GET",
    credentials: "include",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
  }).then((res) => res.json())) as MyRelationsLoaderData;

  const data = await loadFei(params.fei_numero!);
  return json({
    ...data,
    user,
    relationsCatalog: {
      detenteursInitiaux: myRelationsData.data?.detenteursInitiaux || [],
      associationsDeChasse: myRelationsData.data?.associationsDeChasse || [],
      // examinateursInitiaux: myRelationsData.data?.examinateursInitiaux || [],
      ccgs: myRelationsData.data?.ccgs || [],
      collecteursPro: myRelationsData.data?.collecteursPro || [],
      etgs: myRelationsData.data?.etgs || [],
      svis: myRelationsData.data?.svis || [],
      entitiesWorkingFor: myRelationsData.data?.entitiesWorkingFor || [],
    },
  });
}

export default function Fei() {
  const { fei, user, inetermediairesPopulated, nextOwnerEntity } = useLoaderData<typeof clientLoader>();

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
    { tabId: "Destinataires", label: <>{fei.svi_entity_id ? doneEmoji : ""}Destinataires</> },
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
    return "Destinataires";
  });

  const refCurrentRole = useRef(fei.fei_current_owner_role);
  const refCurrentUserId = useRef(fei.fei_current_owner_user_id);
  useEffect(() => {
    if (fei.fei_current_owner_role !== refCurrentRole.current) {
      if (fei.fei_current_owner_user_id === user.id) {
        switch (fei.fei_current_owner_role) {
          case UserRoles.EXAMINATEUR_INITIAL:
            setSelectedTabId(UserRoles.EXAMINATEUR_INITIAL);
            break;
          case UserRoles.PREMIER_DETENTEUR:
            // setSelectedTabId(UserRoles.PREMIER_DETENTEUR);
            break;
          case UserRoles.SVI:
            window.scrollTo({ top: 0, behavior: "smooth" });
            setSelectedTabId(UserRoles.SVI);
            break;
          default:
            window.scrollTo({ top: 0, behavior: "smooth" });
            setSelectedTabId("Destinataires");
            break;
        }
      }
    }
    refCurrentRole.current = fei.fei_current_owner_role;
    refCurrentUserId.current = fei.fei_current_owner_user_id;
  }, [fei.fei_current_owner_role, fei.fei_current_owner_user_id, user.id]);

  const intermediaireTabDisabledText = useMemo(() => {
    const intermediaire = inetermediairesPopulated?.[0];
    if (intermediaire) {
      return "";
    }
    const nextIntermediaireId = fei.fei_next_owner_entity_id;
    if (!nextIntermediaireId) {
      return "Il n'y a pas encore de premier destinataire sélectionné";
    }
    let base = `Le prochain destinataire est&nbsp;: ${nextOwnerEntity?.raison_sociale}.`;
    if (fei.fei_current_owner_user_id === user.id) {
      base += `<br />La fiche n'a pas encore été prise en charge par ce destinataire.`;
    }
    return base;
  }, [inetermediairesPopulated, fei.fei_next_owner_entity_id, nextOwnerEntity, user.id, fei.fei_current_owner_user_id]);

  const sviTabDisabled = useMemo(() => {
    if (fei.svi_signed_at) {
      return false;
    }
    return !user.roles.includes(UserRoles.SVI);
  }, [fei.svi_signed_at, user.roles]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 m-4 bg-white md:m-0 md:p-0 [&_.fr-tabs\\_\\_list]:bg-alt-blue-france">
          <FeiTransfer />
          <ConfirmCurrentOwner />
          <CurrentOwner />
          <Tabs selectedTabId={selectedTabId} tabs={tabs} onTabChange={setSelectedTabId}>
            {selectedTabId === UserRoles.EXAMINATEUR_INITIAL && <FEIExaminateurInitial />}
            {selectedTabId === UserRoles.PREMIER_DETENTEUR && <FEIPremierDetenteur showIdentity />}
            {selectedTabId === "Destinataires" &&
              (intermediaireTabDisabledText ? (
                <p dangerouslySetInnerHTML={{ __html: intermediaireTabDisabledText }} />
              ) : (
                <FEICurrentIntermediaire />
              ))}
            {selectedTabId === UserRoles.SVI &&
              (sviTabDisabled ? <p>Le service vétérinaire n'a pas encore terminé son inspection</p> : <FEI_SVI />)}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
