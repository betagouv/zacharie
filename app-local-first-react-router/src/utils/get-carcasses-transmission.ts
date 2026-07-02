import { CarcasseTransmission } from '@app/types/carcasse';
import { capture } from '@app/services/sentry';
import type { Carcasse } from '@prisma/client';

export function getCarcasseTransmission(carcasseRef: Carcasse): CarcasseTransmission {
  return {
    // fei metadata:
    fei_numero: carcasseRef.fei_numero,
    date_mise_a_mort: carcasseRef.date_mise_a_mort,
    consommateur_final_usage_domestique: carcasseRef.consommateur_final_usage_domestique,
    is_synced: carcasseRef.is_synced,
    created_at: carcasseRef.created_at,
    updated_at: carcasseRef.updated_at,
    // created by:
    created_by_user_id: carcasseRef.created_by_user_id,
    // examinateur:
    examinateur_initial_user_id: carcasseRef.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche:
      carcasseRef.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      carcasseRef.examinateur_initial_date_approbation_mise_sur_le_marche,
    // premier detenteur:
    premier_detenteur_user_id: carcasseRef.premier_detenteur_user_id,
    premier_detenteur_offline: carcasseRef.premier_detenteur_offline,
    premier_detenteur_entity_id: carcasseRef.premier_detenteur_entity_id,
    premier_detenteur_name_cache: carcasseRef.premier_detenteur_name_cache,
    // premier detenteur dépôt:
    premier_detenteur_depot_type: carcasseRef.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: carcasseRef.premier_detenteur_depot_entity_id,
    premier_detenteur_depot_entity_name_cache: carcasseRef.premier_detenteur_depot_entity_name_cache,
    premier_detenteur_depot_ccg_at: carcasseRef.premier_detenteur_depot_ccg_at,
    // premier detenteur transport:
    premier_detenteur_transport_type: carcasseRef.premier_detenteur_transport_type,
    premier_detenteur_transport_date: carcasseRef.premier_detenteur_transport_date,
    // premier détenteur prochain détenteur:
    premier_detenteur_prochain_detenteur_role_cache:
      carcasseRef.premier_detenteur_prochain_detenteur_role_cache,
    premier_detenteur_prochain_detenteur_id_cache: carcasseRef.premier_detenteur_prochain_detenteur_id_cache,
    // refus intermediaire:
    intermediaire_carcasse_refus_intermediaire_id: carcasseRef.intermediaire_carcasse_refus_intermediaire_id,
    intermediaire_carcasse_refus_motif: carcasseRef.intermediaire_carcasse_refus_motif,
    intermediaire_carcasse_manquante: carcasseRef.intermediaire_carcasse_manquante,
    intermediaire_closed_at: carcasseRef.intermediaire_closed_at,
    intermediaire_closed_by_user_id: carcasseRef.intermediaire_closed_by_user_id,
    intermediaire_closed_by_entity_id: carcasseRef.intermediaire_closed_by_entity_id,
    // latest intermediaire:
    latest_intermediaire_signed_at: carcasseRef.latest_intermediaire_signed_at,
    latest_intermediaire_user_id: carcasseRef.latest_intermediaire_user_id,
    latest_intermediaire_entity_id: carcasseRef.latest_intermediaire_entity_id,
    latest_intermediaire_name_cache: carcasseRef.latest_intermediaire_name_cache,
    // svi:
    svi_assigned_at: carcasseRef.svi_assigned_at,
    svi_entity_id: carcasseRef.svi_entity_id,
    svi_user_id: carcasseRef.svi_user_id,
    svi_closed_at: carcasseRef.svi_closed_at,
    svi_automatic_closed_at: carcasseRef.svi_automatic_closed_at,
    svi_closed_by_user_id: carcasseRef.svi_closed_by_user_id,
    // current owner:
    current_owner_user_id: carcasseRef.current_owner_user_id,
    current_owner_user_name_cache: carcasseRef.current_owner_user_name_cache,
    current_owner_entity_id: carcasseRef.current_owner_entity_id,
    current_owner_entity_name_cache: carcasseRef.current_owner_entity_name_cache,
    current_owner_role: carcasseRef.current_owner_role,
    // next owner:
    next_owner_wants_to_sous_traite: carcasseRef.next_owner_wants_to_sous_traite,
    next_owner_sous_traite_at: carcasseRef.next_owner_sous_traite_at,
    next_owner_sous_traite_by_user_id: carcasseRef.next_owner_sous_traite_by_user_id,
    next_owner_sous_traite_by_entity_id: carcasseRef.next_owner_sous_traite_by_entity_id,
    next_owner_user_id: carcasseRef.next_owner_user_id,
    next_owner_user_name_cache: carcasseRef.next_owner_user_name_cache,
    next_owner_entity_id: carcasseRef.next_owner_entity_id,
    next_owner_entity_name_cache: carcasseRef.next_owner_entity_name_cache,
    next_owner_role: carcasseRef.next_owner_role,
    // prev owner:
    prev_owner_user_id: carcasseRef.prev_owner_user_id,
    prev_owner_entity_id: carcasseRef.prev_owner_entity_id,
    prev_owner_role: carcasseRef.prev_owner_role,
  };
}

const ALWAYS_SAME_FIELDS: Partial<Record<keyof CarcasseTransmission, boolean>> = {
  fei_numero: true,
  date_mise_a_mort: true,
  consommateur_final_usage_domestique: true,
  is_synced: true,
  created_at: true,
  updated_at: true,
  examinateur_initial_user_id: true,
  // examinateur_initial_approbation_mise_sur_le_marche: true,
  // examinateur_initial_date_approbation_mise_sur_le_marche: true,
  premier_detenteur_user_id: true,
  premier_detenteur_offline: true,
  premier_detenteur_entity_id: true,
  premier_detenteur_name_cache: true,
  premier_detenteur_depot_type: true,
  premier_detenteur_depot_entity_id: true,
  premier_detenteur_depot_entity_name_cache: true,
  premier_detenteur_depot_ccg_at: true,
  premier_detenteur_transport_type: true,
  premier_detenteur_transport_date: true,
  premier_detenteur_prochain_detenteur_role_cache: true,
  premier_detenteur_prochain_detenteur_id_cache: true,
};
// champs techniques propres à chaque carcasse : ils diffèrent légitimement entre carcasses d'une même transmission
// on ne les compare pas
const PER_CARCASSE_METADATA_FIELDS: Partial<Record<keyof CarcasseTransmission, boolean>> = {
  created_at: true,
  updated_at: true,
  is_synced: true,
  created_by_user_id: true, // because a carcasse can have been created from RequestNewCarcasseForm
  examinateur_initial_approbation_mise_sur_le_marche: true, // because a carcasse can have been created from RequestNewCarcasseForm
  examinateur_initial_date_approbation_mise_sur_le_marche: true, // a carcasse from RequestNewCarcasseForm is approved later, so its approbation date differs legitimately
};

const REFUSAL_FIELDS: Partial<Record<keyof CarcasseTransmission, boolean>> = {
  intermediaire_carcasse_refus_intermediaire_id: true, // when a carcasse is refused, this field is set per carcasse, not per transmission
  intermediaire_carcasse_refus_motif: true, // same
  intermediaire_carcasse_manquante: true, // same
  intermediaire_closed_at: true, // same
  intermediaire_closed_by_user_id: true, // same
  intermediaire_closed_by_entity_id: true, // same
  svi_closed_at: true, // might be automatic closed
  svi_automatic_closed_at: true, // might be manual closed
  svi_closed_by_user_id: true, // might be different from carcasse to carcasse
};

export function checkCarcasseAgainstTransmission(
  transmissionKeys: Array<keyof CarcasseTransmission>,
  transmission: CarcasseTransmission,
  carcasse: Carcasse,
  carcasseRef: Carcasse
) {
  let differ: Record<
    string,
    {
      carcasse: unknown;
      transmission: unknown;
    }
  > = {};
  let shouldNOTdifferButDiffer = false;
  for (let field of transmissionKeys) {
    if (PER_CARCASSE_METADATA_FIELDS[field]) continue; // always differ, we dont care
    if (ALWAYS_SAME_FIELDS[field]) {
      if (carcasse[field] !== transmission[field]) {
        shouldNOTdifferButDiffer = true;
        differ[field] = {
          carcasse: carcasse[field],
          transmission: transmission[field],
        };
      }
    }
    if (carcasse[field] !== transmission[field]) {
      differ[field] = {
        carcasse: carcasse[field],
        transmission: transmission[field],
      };
    }
  }
  if (Object.keys(differ).length) {
    if (!shouldNOTdifferButDiffer) {
      for (const field of Object.keys(differ)) {
        // @ts-expect-error might not be refusal field, so typescript is yelling
        if (REFUSAL_FIELDS[field]) {
          // si une carcasse est refusée, elle sort du circuit
          // donc potentiellement les autres champs comme `next_owner_entity_id` sont légitimement différents
          // donc on arrête de comparer la carcasse avec la transmission
          return;
        }
      }
    }
    capture('Transmssion differs from one of the carcasses', {
      extra: {
        carcasseRef,
        carcasse,
        transmission,
        differ,
      },
      tags: {
        fei_numero: carcasseRef.fei_numero,
        zacharie_carcasse_id: carcasseRef.zacharie_carcasse_id,
      },
    });
  }
}
