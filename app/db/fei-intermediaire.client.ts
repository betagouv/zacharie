import * as zodSchemas from "prisma/generated/zod";
import type { FeiIntermediaire } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import dayjs from "dayjs";

export function mergeFeiIntermediaire(
  oldItem: SerializeFrom<FeiIntermediaire>,
  newItem?: FormData,
): SerializeFrom<FeiIntermediaire> {
  const mergedItem: SerializeFrom<FeiIntermediaire> = newItem
    ? {
        ...oldItem,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...Object.fromEntries(Object.entries(newItem).filter(([_index, value]) => value !== undefined)),
      }
    : oldItem;

  // Explicitly handle each field, including optional ones
  const result = {
    id: mergedItem.id,
    fei_numero: mergedItem.fei_numero,
    fei_intermediaire_user_id: mergedItem.fei_intermediaire_user_id,
    fei_intermediaire_entity_id: mergedItem.fei_intermediaire_entity_id,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),

    /* Optional fields */
    fei_intermediaire_role: mergedItem.fei_intermediaire_role,
    commentaire: mergedItem.commentaire,
    received_at: mergedItem.received_at ? dayjs(mergedItem.received_at).toISOString() : null,
    check_finished_at: mergedItem.check_finished_at ? dayjs(mergedItem.received_at).toISOString() : null,
    handover_at: mergedItem.handover_at ? dayjs(mergedItem.handover_at).toISOString() : null,
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // Validate the result using Zod
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const validatedResult = zodSchemas.FeiIntermediaireSchema.parse(result);

  return result;
}
