import { CarcasseTransmission } from '@app/types/carcasse';
import { capture } from '@app/services/sentry';
import { CarcasseWithModificationRequests } from '@api/src/types/carcasse';

export function getCarcasseTransmission(carcasseRef: CarcasseWithModificationRequests): CarcasseTransmission {
  return {
    fei_numero: carcasseRef.fei_numero,
    date_mise_a_mort: carcasseRef.date_mise_a_mort,
    consommateur_final_usage_domestique: carcasseRef.consommateur_final_usage_domestique,
    premier_detenteur_depot_type: carcasseRef.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: carcasseRef.premier_detenteur_depot_entity_id,
    premier_detenteur_depot_entity_name_cache: carcasseRef.premier_detenteur_depot_entity_name_cache,
    premier_detenteur_depot_ccg_at: carcasseRef.premier_detenteur_depot_ccg_at,
    premier_detenteur_transport_type: carcasseRef.premier_detenteur_transport_type,
    premier_detenteur_transport_date: carcasseRef.premier_detenteur_transport_date,
    premier_detenteur_prochain_detenteur_role_cache:
      carcasseRef.premier_detenteur_prochain_detenteur_role_cache,
    premier_detenteur_prochain_detenteur_id_cache: carcasseRef.premier_detenteur_prochain_detenteur_id_cache,
    intermediaire_carcasse_refus_intermediaire_id: carcasseRef.intermediaire_carcasse_refus_intermediaire_id,
    intermediaire_carcasse_refus_motif: carcasseRef.intermediaire_carcasse_refus_motif,
    intermediaire_carcasse_manquante: carcasseRef.intermediaire_carcasse_manquante,
    latest_intermediaire_signed_at: carcasseRef.latest_intermediaire_signed_at,
    svi_assigned_to_fei_at: carcasseRef.svi_assigned_to_fei_at,
    created_by_user_id: carcasseRef.created_by_user_id,
    examinateur_initial_user_id: carcasseRef.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche:
      carcasseRef.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      carcasseRef.examinateur_initial_date_approbation_mise_sur_le_marche,
    premier_detenteur_user_id: carcasseRef.premier_detenteur_user_id,
    premier_detenteur_offline: carcasseRef.premier_detenteur_offline,
    premier_detenteur_entity_id: carcasseRef.premier_detenteur_entity_id,
    premier_detenteur_name_cache: carcasseRef.premier_detenteur_name_cache,
    intermediaire_closed_at: carcasseRef.intermediaire_closed_at,
    intermediaire_closed_by_user_id: carcasseRef.intermediaire_closed_by_user_id,
    intermediaire_closed_by_entity_id: carcasseRef.intermediaire_closed_by_entity_id,
    latest_intermediaire_user_id: carcasseRef.latest_intermediaire_user_id,
    latest_intermediaire_entity_id: carcasseRef.latest_intermediaire_entity_id,
    latest_intermediaire_name_cache: carcasseRef.latest_intermediaire_name_cache,
    svi_assigned_at: carcasseRef.svi_assigned_at,
    svi_entity_id: carcasseRef.svi_entity_id,
    svi_user_id: carcasseRef.svi_user_id,
    svi_closed_at: carcasseRef.svi_closed_at,
    svi_automatic_closed_at: carcasseRef.svi_automatic_closed_at,
    svi_closed_by_user_id: carcasseRef.svi_closed_by_user_id,
    current_owner_user_id: carcasseRef.current_owner_user_id,
    current_owner_user_name_cache: carcasseRef.current_owner_user_name_cache,
    current_owner_entity_id: carcasseRef.current_owner_entity_id,
    current_owner_entity_name_cache: carcasseRef.current_owner_entity_name_cache,
    current_owner_role: carcasseRef.current_owner_role,
    next_owner_wants_to_sous_traite: carcasseRef.next_owner_wants_to_sous_traite,
    next_owner_sous_traite_at: carcasseRef.next_owner_sous_traite_at,
    next_owner_sous_traite_by_user_id: carcasseRef.next_owner_sous_traite_by_user_id,
    next_owner_sous_traite_by_entity_id: carcasseRef.next_owner_sous_traite_by_entity_id,
    next_owner_user_id: carcasseRef.next_owner_user_id,
    next_owner_user_name_cache: carcasseRef.next_owner_user_name_cache,
    next_owner_entity_id: carcasseRef.next_owner_entity_id,
    next_owner_entity_name_cache: carcasseRef.next_owner_entity_name_cache,
    next_owner_role: carcasseRef.next_owner_role,
    prev_owner_user_id: carcasseRef.prev_owner_user_id,
    prev_owner_entity_id: carcasseRef.prev_owner_entity_id,
    prev_owner_role: carcasseRef.prev_owner_role,
    is_synced: carcasseRef.is_synced,
    created_at: carcasseRef.created_at,
    updated_at: carcasseRef.updated_at,
  };
}

export function checkCarcasseAgainstTransmission(
  transmissionKeys: Array<keyof CarcasseTransmission>,
  transmission: CarcasseTransmission,
  carcasse: CarcasseWithModificationRequests,
  carcasseRef: CarcasseWithModificationRequests
) {
  let differ: Record<
    string,
    {
      carcasse: unknown;
      transmission: unknown;
    }
  > = {};
  for (let field of transmissionKeys) {
    if (carcasse[field] !== transmission[field]) {
      differ[field] = {
        carcasse: carcasse[field],
        transmission: transmission[field],
      };
    }
  }
  if (Object.keys(differ).length) {
    capture('Transmssion differs from one of the carcasses', {
      extra: {
        carcasseRef,
        carcasse,
        transmission,
        differ,
      },
    });
  }
}
