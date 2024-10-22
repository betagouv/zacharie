// import * as zodSchemas from "prisma/generated/zod";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";
import { redirect } from "@remix-run/react";
import { type Fei, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
import { type FeiLoaderData } from "@api/routes/api.fei.$fei_numero";
import { type FeiUserLoaderData } from "@api/routes/api.fei-user.$fei_numero.$user_id";
import { type FeiEntityLoaderData } from "@api/routes/api.fei-entity.$fei_numero.$entity_id";
import { type CarcassesLoaderData } from "@api/routes/api.fei-carcasses.$fei_numero";
import { type FeiIntermediairesLoaderData } from "@api/routes/api.fei-intermediaires.$fei_numero";
import {
  type CarcasseIntermediaireLoaderData,
  type CarcasseIntermediaireActionData,
} from "@api/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet";
import { mergeCarcasseIntermediaire } from "./carcasse-intermediaire.client";

// Implementation
export function mergeFeiToJSON(oldItem: SerializeFrom<Fei>, newItem: FormData = new FormData()): SerializeFrom<Fei> {
  if (newItem) {
    for (const key of newItem?.keys() ?? []) {
      if (newItem?.get(key) === undefined) {
        newItem!.delete(key);
      }
    }
  }

  const mergedItem: SerializeFrom<Fei> = {
    ...oldItem,
    ...Object.fromEntries(newItem!),
  };

  const next_examinateur_initial_approbation_mise_sur_le_marche =
    newItem?.get("examinateur_initial_approbation_mise_sur_le_marche") === "true"
      ? true
      : newItem?.get("examinateur_initial_approbation_mise_sur_le_marche") === "false"
        ? false
        : mergedItem.examinateur_initial_approbation_mise_sur_le_marche || null;
  // Explicitly handle each field, including optional ones
  const result = {
    id: mergedItem.id || Date.now(),
    numero: mergedItem.numero,
    date_mise_a_mort: mergedItem.date_mise_a_mort ? dayjs(mergedItem.date_mise_a_mort).toISOString() : null,
    commune_mise_a_mort: mergedItem.commune_mise_a_mort || null,
    heure_mise_a_mort_premiere_carcasse: mergedItem.heure_mise_a_mort_premiere_carcasse || null,
    heure_evisceration_derniere_carcasse: mergedItem.heure_evisceration_derniere_carcasse || null,
    created_by_user_id: mergedItem.created_by_user_id,
    fei_current_owner_user_id: mergedItem.fei_current_owner_user_id || null,
    fei_current_owner_entity_id: mergedItem.fei_current_owner_entity_id || null,
    fei_current_owner_role: mergedItem.fei_current_owner_role || null,
    fei_current_owner_wants_to_transfer:
      newItem?.get("fei_current_owner_wants_to_transfer") === "true"
        ? true
        : newItem?.get("fei_current_owner_wants_to_transfer") === "false"
          ? false
          : mergedItem.fei_current_owner_wants_to_transfer || null,
    fei_next_owner_user_id: mergedItem.fei_next_owner_user_id || null,
    fei_next_owner_entity_id: mergedItem.fei_next_owner_entity_id || null,
    fei_next_owner_role: mergedItem.fei_next_owner_role || null,
    fei_prev_owner_user_id: mergedItem.fei_prev_owner_user_id || null,
    fei_prev_owner_entity_id: mergedItem.fei_prev_owner_entity_id || null,
    fei_prev_owner_role: mergedItem.fei_prev_owner_role || null,
    examinateur_initial_user_id: mergedItem.examinateur_initial_user_id || null,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      next_examinateur_initial_approbation_mise_sur_le_marche === true
        ? dayjs(mergedItem.examinateur_initial_date_approbation_mise_sur_le_marche || undefined).toISOString()
        : null,
    examinateur_initial_approbation_mise_sur_le_marche: next_examinateur_initial_approbation_mise_sur_le_marche,
    premier_detenteur_user_id: mergedItem.premier_detenteur_user_id || null,
    premier_detenteur_entity_id: mergedItem.premier_detenteur_entity_id || null,
    premier_detenteur_name_cache: mergedItem.premier_detenteur_name_cache || null,
    premier_detenteur_date_depot_quelque_part: mergedItem.premier_detenteur_date_depot_quelque_part
      ? dayjs(mergedItem.premier_detenteur_date_depot_quelque_part).toISOString()
      : null,
    premier_detenteur_depot_entity_id: mergedItem.premier_detenteur_depot_entity_id || null,
    premier_detenteur_depot_sauvage: mergedItem.premier_detenteur_depot_sauvage || null,
    svi_entity_id: mergedItem.svi_entity_id || null,
    svi_user_id: mergedItem.svi_user_id || null,
    svi_carcasses_saisies: mergedItem.svi_carcasses_saisies || null,
    svi_aucune_carcasse_saisie:
      newItem?.get("svi_aucune_carcasse_saisie") === "true"
        ? true
        : newItem?.get("svi_aucune_carcasse_saisie") === "false"
          ? false
          : mergedItem.svi_aucune_carcasse_saisie || null,
    svi_commentaire: mergedItem.svi_commentaire || null,
    svi_signed_at: mergedItem.svi_signed_at ? dayjs(mergedItem.svi_signed_at).toISOString() : null,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // console.log("feoi result", result);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const validatedResult = zodSchemas.FeiSchema.parse(result);
  // console.log({ validatedResult });

  return result;
}

export function mergeFei(oldItem: SerializeFrom<Fei>, newItem?: FormData): FormData {
  const result = mergeFeiToJSON(oldItem, newItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFormData(object: Record<string, any>) {
    const formData = new FormData();
    Object.keys(object).forEach((key) => formData.append(key, object[key]));
    return formData;
  }
  return getFormData(result) satisfies FormData;
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

export async function loadFei(fei_numero: string) {
  const feiData = (await get(`/api/fei/${fei_numero}`)) as FeiLoaderData;

  if (!feiData.ok) {
    return redirect("/app/tableau-de-bord");
  }

  const examinateurInitialId = feiData.data?.fei.examinateur_initial_user_id;
  const examinateurInitialUser = examinateurInitialId
    ? ((await get(`/api/fei-user/${fei_numero}/${examinateurInitialId}`)) as FeiUserLoaderData)
    : null;

  const premierDetenteurId = feiData.data?.fei.premier_detenteur_user_id;
  const premierDetenteurUser = premierDetenteurId
    ? ((await get(`/api/fei-user/${fei_numero}/${premierDetenteurId}`)) as FeiUserLoaderData)
    : null;

  const premierDetenteurEntityId = feiData.data?.fei.premier_detenteur_entity_id;
  const premierDetenteurEntity = premierDetenteurEntityId
    ? ((await get(`/api/fei-entity/${fei_numero}/${premierDetenteurEntityId}`)) as FeiEntityLoaderData)
    : null;

  const depotEntityId = feiData.data?.fei.premier_detenteur_depot_entity_id;
  const premierDetenteurDepotEntityId = depotEntityId
    ? ((await get(`/api/fei-entity/${fei_numero}/${depotEntityId}`)) as FeiEntityLoaderData)
    : null;

  const currentOwnerId = feiData.data?.fei.fei_current_owner_user_id;
  const currentOwnerUser = currentOwnerId
    ? ((await get(`/api/fei-user/${fei_numero}/${currentOwnerId}`)) as FeiUserLoaderData)
    : null;

  const currentOwnerEntityId = feiData.data?.fei.fei_current_owner_entity_id;
  const currentOwnerEntity = currentOwnerEntityId
    ? ((await get(`/api/fei-entity/${fei_numero}/${currentOwnerEntityId}`)) as FeiEntityLoaderData)
    : null;

  const nextOwnerUserId = feiData.data?.fei.fei_next_owner_user_id;
  const nextOwnerUser = nextOwnerUserId
    ? ((await get(`/api/fei-user/${fei_numero}/${nextOwnerUserId}`)) as FeiUserLoaderData)
    : null;

  const nextOwnerEntityId = feiData.data?.fei.fei_next_owner_entity_id;
  const nextOwnerEntity = nextOwnerEntityId
    ? ((await get(`/api/fei-entity/${fei_numero}/${nextOwnerEntityId}`)) as FeiEntityLoaderData)
    : null;

  const sviUserId = feiData.data?.fei.svi_user_id;
  const sviUser = sviUserId ? ((await get(`/api/fei-user/${fei_numero}/${sviUserId}`)) as FeiUserLoaderData) : null;

  const sviEntityid = feiData.data?.fei.svi_entity_id;
  const svi = sviEntityid ? ((await get(`/api/fei-entity/${fei_numero}/${sviEntityid}`)) as FeiEntityLoaderData) : null;

  const carcasses = (await get(`/api/fei-carcasses/${fei_numero}`)) as CarcassesLoaderData;

  const intermediaires = (await get(`/api/fei-intermediaires/${fei_numero}`)) as FeiIntermediairesLoaderData;
  const inetermediairesPopulated = [];

  for (const intermediaire of intermediaires.data?.intermediaires || []) {
    const intermediaireUser = intermediaire.fei_intermediaire_user_id
      ? ((await get(`/api/fei-user/${fei_numero}/${intermediaire.fei_intermediaire_user_id}`)) as FeiUserLoaderData)
      : null;
    const intermediaireEntity = intermediaire.fei_intermediaire_entity_id
      ? ((await get(
          `/api/fei-entity/${fei_numero}/${intermediaire.fei_intermediaire_entity_id}`,
        )) as FeiEntityLoaderData)
      : null;
    const intermediaireCarcasses: Record<Carcasse["numero_bracelet"], SerializeFrom<CarcasseIntermediaire>> = {};
    for (const carcasse of carcasses.data?.carcasses || []) {
      const intermediaireCarcasse = (await get(
        `/api/fei-carcasse-intermediaire/${fei_numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
      )) as CarcasseIntermediaireLoaderData;
      const carcasseIntermediaire = intermediaireCarcasse.data?.carcasseIntermediaire;
      if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
        const refusOrManquanteAt = carcasse.intermediaire_carcasse_signed_at;
        if (refusOrManquanteAt && intermediaire.created_at > refusOrManquanteAt) {
          continue;
        }
      }
      if (!carcasseIntermediaire) {
        const newCarcasseIntermediaire = mergeCarcasseIntermediaire({
          fei_numero__bracelet__intermediaire_id: `${fei_numero}__${carcasse.numero_bracelet}__${intermediaire.id}`,
          fei_numero: fei_numero,
          numero_bracelet: carcasse.numero_bracelet,
          fei_intermediaire_id: intermediaire.id,
          fei_intermediaire_user_id: intermediaire.fei_intermediaire_user_id,
          fei_intermediaire_entity_id: intermediaire.fei_intermediaire_entity_id,
          created_at: dayjs().toISOString(),
          updated_at: dayjs().toISOString(),
          prise_en_charge: !carcasse.intermediaire_carcasse_manquante,
          manquante: carcasse.intermediaire_carcasse_manquante,
          refus: null,
          commentaire: null,
          carcasse_check_finished_at: dayjs().toISOString(),
          deleted_at: null,
        });
        for (const key of newCarcasseIntermediaire.keys()) {
          if (newCarcasseIntermediaire.get(key) === "null") {
            newCarcasseIntermediaire.set(key, "");
          }
        }
        console.log("newCarcasseIntermediaire", Object.fromEntries(newCarcasseIntermediaire));
        const newCarcasseIntermediaireRes = (await fetch(
          `${import.meta.env.VITE_API_URL}/api/fei-carcasse-intermediaire/${fei_numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
          {
            method: "POST",
            credentials: "include",
            headers: new Headers({
              Accept: "application/json",
            }),
            body: newCarcasseIntermediaire,
          },
        ).then((res) => res.json())) as CarcasseIntermediaireActionData;
        if (newCarcasseIntermediaireRes.ok) {
          intermediaireCarcasses[carcasse.numero_bracelet] = newCarcasseIntermediaireRes.data!.carcasseIntermediaire;
        }
      } else {
        intermediaireCarcasses[carcasse.numero_bracelet] = carcasseIntermediaire;
      }
    }
    inetermediairesPopulated.push({
      ...intermediaire,
      user: intermediaireUser?.data?.user,
      entity: intermediaireEntity?.data?.entity,
      carcasses: intermediaireCarcasses,
    });
  }

  return {
    fei: feiData.data!.fei,
    examinateurInitialUser: examinateurInitialUser?.data?.user,
    premierDetenteurUser: premierDetenteurUser?.data?.user,
    premierDetenteurEntity: premierDetenteurEntity?.data?.entity,
    premierDetenteurDepotEntity: premierDetenteurDepotEntityId?.data?.entity,
    currentOwnerUser: currentOwnerUser?.data?.user,
    currentOwnerEntity: currentOwnerEntity?.data?.entity,
    nextOwnerUser: nextOwnerUser?.data?.user,
    nextOwnerEntity: nextOwnerEntity?.data?.entity,
    sviUser: sviUser?.data?.user,
    svi: svi?.data?.entity,
    carcasses: carcasses.data?.carcasses || [],
    inetermediairesPopulated,
  };
}
