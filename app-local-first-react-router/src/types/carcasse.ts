import type { Carcasse, Fei } from '@prisma/client';
import { CarcassesIntermediaire } from './carcasses-intermediaire';
import {
  TransmissionNextStep,
  TransmissionSimpleStatus,
  TransmissionStep,
  TransmissionStepForTransportOrSoustraite,
} from './transmission-steps';

export interface CarcasseFieldsTakenFromFei {
  date_mise_a_mort: Carcasse['date_mise_a_mort'];
  heure_mise_a_mort: Carcasse['heure_mise_a_mort'];
  heure_evisceration: Carcasse['heure_evisceration'];
  heure_mise_a_mort_premiere_carcasse_fei: Carcasse['heure_mise_a_mort_premiere_carcasse_fei'];
  heure_evisceration_derniere_carcasse_fei: Carcasse['heure_evisceration_derniere_carcasse_fei'];
  premier_detenteur_depot_type: Carcasse['premier_detenteur_depot_type'];
  premier_detenteur_depot_entity_id: Carcasse['premier_detenteur_depot_entity_id'];
  premier_detenteur_depot_entity_name_cache: Carcasse['premier_detenteur_depot_entity_name_cache'];
  premier_detenteur_depot_ccg_at: Carcasse['premier_detenteur_depot_ccg_at'];
  premier_detenteur_transport_type: Carcasse['premier_detenteur_transport_type'];
  premier_detenteur_transport_date: Carcasse['premier_detenteur_transport_date'];
  premier_detenteur_prochain_detenteur_role_cache: Carcasse['premier_detenteur_prochain_detenteur_role_cache'];
  premier_detenteur_prochain_detenteur_id_cache: Carcasse['premier_detenteur_prochain_detenteur_id_cache'];
  examinateur_initial_offline: Carcasse['examinateur_initial_offline'];
  examinateur_initial_user_id: Carcasse['examinateur_initial_user_id'];
  examinateur_initial_approbation_mise_sur_le_marche: Carcasse['examinateur_initial_approbation_mise_sur_le_marche'];
  examinateur_initial_date_approbation_mise_sur_le_marche: Carcasse['examinateur_initial_date_approbation_mise_sur_le_marche'];
  consommateur_final_usage_domestique: Carcasse['consommateur_final_usage_domestique'];
  premier_detenteur_offline: Carcasse['premier_detenteur_offline'];
  premier_detenteur_user_id: Carcasse['premier_detenteur_user_id'];
  premier_detenteur_entity_id: Carcasse['premier_detenteur_entity_id'];
  premier_detenteur_name_cache: Carcasse['premier_detenteur_name_cache'];
  intermediaire_closed_at: Carcasse['intermediaire_closed_at'];
  intermediaire_closed_by_user_id: Carcasse['intermediaire_closed_by_user_id'];
  intermediaire_closed_by_entity_id: Carcasse['intermediaire_closed_by_entity_id'];
  latest_intermediaire_user_id: Carcasse['latest_intermediaire_user_id'];
  latest_intermediaire_entity_id: Carcasse['latest_intermediaire_entity_id'];
  latest_intermediaire_name_cache: Carcasse['latest_intermediaire_name_cache'];
  svi_assigned_at: Carcasse['svi_assigned_at'];
  svi_user_id: Carcasse['svi_user_id'];
}

export type CarcasseTransmission = Partial<
  Pick<
    Carcasse,
    | 'fei_numero'
    | 'date_mise_a_mort'
    | 'consommateur_final_usage_domestique'
    | 'premier_detenteur_depot_type'
    | 'premier_detenteur_depot_entity_id'
    | 'premier_detenteur_depot_entity_name_cache'
    | 'premier_detenteur_depot_ccg_at'
    | 'premier_detenteur_transport_type'
    | 'premier_detenteur_transport_date'
    | 'premier_detenteur_prochain_detenteur_role_cache'
    | 'premier_detenteur_prochain_detenteur_id_cache'
    | 'intermediaire_carcasse_refus_intermediaire_id'
    | 'intermediaire_carcasse_refus_motif'
    | 'intermediaire_carcasse_manquante'
    | 'latest_intermediaire_signed_at'
    | 'svi_assigned_to_fei_at'
    | 'created_by_user_id'
    | 'examinateur_initial_user_id'
    | 'examinateur_initial_approbation_mise_sur_le_marche'
    | 'examinateur_initial_date_approbation_mise_sur_le_marche'
    | 'premier_detenteur_user_id'
    | 'premier_detenteur_offline'
    | 'premier_detenteur_entity_id'
    | 'premier_detenteur_name_cache'
    | 'intermediaire_closed_at'
    | 'intermediaire_closed_by_user_id'
    | 'intermediaire_closed_by_entity_id'
    | 'latest_intermediaire_user_id'
    | 'latest_intermediaire_entity_id'
    | 'latest_intermediaire_name_cache'
    | 'svi_assigned_at'
    | 'svi_entity_id'
    | 'svi_user_id'
    | 'svi_closed_at'
    | 'svi_automatic_closed_at'
    | 'svi_closed_by_user_id'
    | 'current_owner_user_id'
    | 'current_owner_user_name_cache'
    | 'current_owner_entity_id'
    | 'current_owner_entity_name_cache'
    | 'current_owner_role'
    | 'next_owner_wants_to_sous_traite'
    | 'next_owner_sous_traite_at'
    | 'next_owner_sous_traite_by_user_id'
    | 'next_owner_sous_traite_by_entity_id'
    | 'next_owner_user_id'
    | 'next_owner_user_name_cache'
    | 'next_owner_entity_id'
    | 'next_owner_entity_name_cache'
    | 'next_owner_role'
    | 'prev_owner_user_id'
    | 'prev_owner_entity_id'
    | 'prev_owner_role'
    | 'is_synced'
    | 'created_at'
    | 'updated_at'
  >
>;

export type CarcasseForCounting = Pick<
  Carcasse,
  | 'zacharie_carcasse_id'
  | 'espece'
  | 'type'
  | 'nombre_d_animaux'
  | 'deleted_at'
  | 'svi_carcasse_status'
  | 'svi_ipm2_nombre_animaux'
>;

export type CarcasseTransmissionWihMetadata = {
  content: CarcasseTransmission;
  intermediaires: Array<CarcassesIntermediaire>;
  fei: Pick<Fei, 'numero' | 'commune_mise_a_mort' | 'date_mise_a_mort'>;
  allCarcassesDone?: boolean;
  labels: {
    simpleStatus: TransmissionSimpleStatus;
    currentStepLabel: TransmissionStep;
    nextStepLabel: TransmissionNextStep;
    transportOrSoustraiteLabel: TransmissionStepForTransportOrSoustraite;
  };
  carcasses: Array<Carcasse>;
};
