import * as zodSchemas from "prisma/generated/zod";
import type { CarcasseIntermediaire } from "@prisma/client";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";

export function mergeCarcasseIntermediaire(
  oldItem: SerializeFrom<CarcasseIntermediaire>,
  newItem?: FormData,
): SerializeFrom<CarcasseIntermediaire> {
  const mergedItem: SerializeFrom<CarcasseIntermediaire> = newItem
    ? {
        ...oldItem,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...Object.fromEntries(Object.entries(newItem).filter(([_index, value]) => value !== undefined)),
      }
    : oldItem;

  // Explicitly handle each field, including optional ones
  const result = {
    fei_numero__bracelet__intermediaire_id: mergedItem.fei_numero__bracelet__intermediaire_id,
    fei_numero: mergedItem.fei_numero,
    numero_bracelet: mergedItem.numero_bracelet,
    fei_intermediaire_id: mergedItem.fei_intermediaire_id,
    fei_intermediaire_user_id: mergedItem.fei_intermediaire_user_id,
    fei_intermediaire_entity_id: mergedItem.fei_intermediaire_entity_id,
    created_at: dayjs(mergedItem.created_at).toISOString(),
    updated_at: dayjs(mergedItem.updated_at).toISOString(),

    // Optional fields
    prise_en_charge: mergedItem.prise_en_charge ?? null,
    refus: mergedItem.refus ?? null,
    commentaire: mergedItem.commentaire ?? null,
    carcasse_check_finished_at: mergedItem.carcasse_check_finished_at
      ? dayjs(mergedItem.carcasse_check_finished_at).toISOString()
      : null,
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const validated = zodSchemas.CarcasseIntermediaireSchema.parse(result);

  return result;
}
