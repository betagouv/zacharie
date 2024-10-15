// import * as zodSchemas from "prisma/generated/zod";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";
import { type Fei, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
import { type FeiLoaderData } from "@api/routes/api.fei.$fei_numero";
import { type FeiUserLoaderData } from "@api/routes/api.fei-user.$fei_numero.$user_id";
import { type FeiEntityLoaderData } from "@api/routes/api.fei-entity.$fei_numero.$entity_id";
import { type CarcassesLoaderData } from "@api/routes/api.fei-carcasses.$fei_numero";
import { type FeiIntermediairesLoaderData } from "@api/routes/api.fei-intermediaires.$fei_numero";
import { type CarcasseIntermediaireLoaderData } from "@api/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet";

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

  // Explicitly handle each field, including optional ones
  const result = {
    id: mergedItem.id || Date.now(),
    numero: mergedItem.numero,
    date_mise_a_mort: mergedItem.date_mise_a_mort ? dayjs(mergedItem.date_mise_a_mort).toISOString() : null,
    commune_mise_a_mort: mergedItem.commune_mise_a_mort || null,
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
      mergedItem.examinateur_initial_date_approbation_mise_sur_le_marche
        ? dayjs(mergedItem.examinateur_initial_date_approbation_mise_sur_le_marche).toISOString()
        : null,
    examinateur_initial_approbation_mise_sur_le_marche:
      newItem?.get("examinateur_initial_approbation_mise_sur_le_marche") === "true"
        ? true
        : newItem?.get("examinateur_initial_approbation_mise_sur_le_marche") === "false"
          ? false
          : mergedItem.examinateur_initial_approbation_mise_sur_le_marche || null,
    premier_detenteur_user_id: mergedItem.premier_detenteur_user_id || null,
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

  console.log("feoi result", result);
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

  const examinateurInitialId = feiData.data?.fei.examinateur_initial_user_id;
  const examinateurInitialUser = examinateurInitialId
    ? ((await get(`/api/fei-user/${fei_numero}/${examinateurInitialId}`)) as FeiUserLoaderData)
    : null;

  const premierDetenteurId = feiData.data?.fei.premier_detenteur_user_id;
  const premierDetenteurUser = premierDetenteurId
    ? ((await get(`/api/fei-user/${fei_numero}/${premierDetenteurId}`)) as FeiUserLoaderData)
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
      if (intermediaireCarcasse.data?.carcasseIntermediaire) {
        intermediaireCarcasses[carcasse.numero_bracelet] = intermediaireCarcasse.data?.carcasseIntermediaire;
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
