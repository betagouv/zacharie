// import * as zodSchemas from "prisma/generated/zod";
import type { FeiIntermediaire } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import dayjs from "dayjs";

export function mergeFeiIntermediaireToJSON(
  oldItem: SerializeFrom<FeiIntermediaire>,
  newItem: FormData = new FormData(),
): SerializeFrom<FeiIntermediaire> {
  if (newItem) {
    for (const key of newItem?.keys() ?? []) {
      if (newItem?.get(key) === undefined) {
        newItem!.delete(key);
      }
    }
  }
  const mergedItem: SerializeFrom<FeiIntermediaire> = {
    ...oldItem,
    ...Object.fromEntries(newItem!),
  };

  console.log({ mergedItem });
  // Explicitly handle each field, including optional ones
  const result = {
    id: mergedItem.id,
    fei_numero: mergedItem.fei_numero,
    fei_intermediaire_user_id: mergedItem.fei_intermediaire_user_id, // not an
    fei_intermediaire_entity_id: mergedItem.fei_intermediaire_entity_id,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),

    /* Optional fields */
    fei_intermediaire_role: mergedItem.fei_intermediaire_role || null,
    commentaire: mergedItem.commentaire || null,
    received_at: mergedItem.received_at ? dayjs(mergedItem.received_at).toISOString() : null,
    check_finished_at: mergedItem.check_finished_at === "true" ? dayjs().toISOString() : null,
    handover_at: mergedItem.handover_at ? dayjs(mergedItem.handover_at).toISOString() : null,
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // const validatedFeiIntermediaireResult = zodSchemas.FeiIntermediaireSchema.parse(result);
  // console.log({ validatedFeiIntermediaireResult });

  return result;
}

export function mergeFeiIntermediaire(oldItem: SerializeFrom<FeiIntermediaire>, newItem?: FormData): FormData {
  const result = mergeFeiIntermediaireToJSON(oldItem, newItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFormData(object: Record<string, any>) {
    const formData = new FormData();
    Object.keys(object).forEach((key) => formData.append(key, object[key]));
    return formData;
  }
  return getFormData(result) satisfies FormData;
}
