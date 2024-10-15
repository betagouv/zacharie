// import * as zodSchemas from "prisma/generated/zod";
import type { CarcasseIntermediaire } from "@prisma/client";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";

// Implementation
export function mergeCarcasseIntermediaireToJSON(
  oldItem: SerializeFrom<CarcasseIntermediaire>,
  newItem: FormData = new FormData(),
): SerializeFrom<CarcasseIntermediaire> {
  if (newItem) {
    for (const key of newItem?.keys() ?? []) {
      if (newItem?.get(key) === undefined) {
        newItem!.delete(key);
      }
    }
  }
  const mergedItem: SerializeFrom<CarcasseIntermediaire> = {
    ...oldItem,
    ...Object.fromEntries(newItem!),
  };

  // Explicitly handle each field, including optional ones
  const result: SerializeFrom<CarcasseIntermediaire> = {
    fei_numero__bracelet__intermediaire_id: mergedItem.fei_numero__bracelet__intermediaire_id,
    fei_numero: mergedItem.fei_numero,
    numero_bracelet: mergedItem.numero_bracelet,
    fei_intermediaire_id: mergedItem.fei_intermediaire_id,
    fei_intermediaire_user_id: mergedItem.fei_intermediaire_user_id,
    fei_intermediaire_entity_id: mergedItem.fei_intermediaire_entity_id,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),
    // Optional fields
    prise_en_charge:
      newItem?.get("prise_en_charge") === "true"
        ? true
        : newItem?.get("prise_en_charge") === "false"
          ? false
          : oldItem.prise_en_charge || null,
    refus: mergedItem.refus || null,
    commentaire: mergedItem.commentaire || null,
    carcasse_check_finished_at: mergedItem.carcasse_check_finished_at
      ? dayjs(mergedItem.carcasse_check_finished_at).toISOString()
      : null,
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const zodCarcasseIntermediaireResult = zodSchemas.CarcasseIntermediaireSchema.parse(result);
  // console.log({ zodCarcasseIntermediaireResult });

  return result satisfies SerializeFrom<CarcasseIntermediaire>;
}

export function mergeCarcasseIntermediaire(
  oldItem: SerializeFrom<CarcasseIntermediaire>,
  newItem?: FormData,
): FormData {
  const result = mergeCarcasseIntermediaireToJSON(oldItem, newItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFormData(object: Record<string, any>) {
    const formData = new FormData();
    Object.keys(object).forEach((key) => formData.append(key, object[key]));
    return formData;
  }
  return getFormData(result) satisfies FormData;
}
