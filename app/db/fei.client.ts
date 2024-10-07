import * as zodSchemas from "prisma/generated/zod";
import type { Fei } from "@prisma/client";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";

export function mergeFei(oldItem: SerializeFrom<Fei>, newItem?: FormData): SerializeFrom<Fei> {
  const mergedItem: SerializeFrom<Fei> = newItem
    ? {
        ...oldItem,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...Object.fromEntries(Object.entries(newItem).filter(([_index, value]) => value !== undefined)),
      }
    : oldItem;

  // Explicitly handle each field, including optional ones
  const result = {
    id: mergedItem.id,
    numero: mergedItem.numero,
    date_mise_a_mort: mergedItem.date_mise_a_mort ? dayjs(mergedItem.date_mise_a_mort).toISOString() : null,
    commune_mise_a_mort: mergedItem.commune_mise_a_mort,
    created_by_user_id: mergedItem.created_by_user_id,
    fei_current_owner_user_id: mergedItem.fei_current_owner_user_id,
    fei_current_owner_entity_id: mergedItem.fei_current_owner_entity_id,
    fei_current_owner_role: mergedItem.fei_current_owner_role,
    fei_current_owner_wants_to_transfer: mergedItem.fei_current_owner_wants_to_transfer,
    fei_next_owner_user_id: mergedItem.fei_next_owner_user_id,
    fei_next_owner_entity_id: mergedItem.fei_next_owner_entity_id,
    fei_next_owner_role: mergedItem.fei_next_owner_role,
    fei_prev_owner_user_id: mergedItem.fei_prev_owner_user_id,
    fei_prev_owner_entity_id: mergedItem.fei_prev_owner_entity_id,
    fei_prev_owner_role: mergedItem.fei_prev_owner_role,
    examinateur_initial_user_id: mergedItem.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche: mergedItem.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      mergedItem.examinateur_initial_date_approbation_mise_sur_le_marche,
    premier_detenteur_user_id: mergedItem.premier_detenteur_user_id,
    premier_detenteur_date_depot_quelque_part: mergedItem.premier_detenteur_date_depot_quelque_part,
    premier_detenteur_depot_entity_id: mergedItem.premier_detenteur_depot_entity_id,
    premier_detenteur_depot_sauvage: mergedItem.premier_detenteur_depot_sauvage,
    svi_entity_id: mergedItem.svi_entity_id,
    svi_user_id: mergedItem.svi_user_id,
    svi_carcasses_saisies: mergedItem.svi_carcasses_saisies,
    svi_aucune_carcasse_saisie: mergedItem.svi_aucune_carcasse_saisie,
    svi_commentaire: mergedItem.svi_commentaire,
    svi_signed_at: mergedItem.svi_signed_at ? dayjs(mergedItem.svi_signed_at).toISOString() : null,
    created_at: dayjs(mergedItem.created_at).toISOString(),
    updated_at: dayjs(mergedItem.updated_at).toISOString(),
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const validated = zodSchemas.FeiSchema.parse(result);

  return result;
}
