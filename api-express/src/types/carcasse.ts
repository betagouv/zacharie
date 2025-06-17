import { CarcasseStatus, Fei, Prisma } from '@prisma/client';

export const carcasseForRegistrySelect = {
  zacharie_carcasse_id: true,
  numero_bracelet: true,
  fei_numero: true,
  type: true,
  nombre_d_animaux: true,
  heure_mise_a_mort: true,
  heure_evisceration: true,
  espece: true,
  categorie: true,
  // examinateur_carcasse_sans_anomalie: false,
  // examinateur_anomalies_carcasse: false,
  // examinateur_anomalies_abats: false,
  // examinateur_commentaire: false,
  // examinateur_signed_at: false,
  intermediaire_carcasse_refus_intermediaire_id: true,
  intermediaire_carcasse_refus_motif: true,
  intermediaire_carcasse_signed_at: true,
  intermediaire_carcasse_commentaire: true,
  intermediaire_carcasse_manquante: true,
  svi_assigned_to_fei_at: true,
  svi_carcasse_commentaire: true,
  svi_carcasse_status: true,
  svi_carcasse_status_set_at: true,
  svi_ipm1_date: true,
  svi_ipm1_presentee_inspection: true,
  svi_ipm1_user_id: true,
  svi_ipm1_user_name_cache: true,
  svi_ipm1_protocole: true,
  svi_ipm1_pieces: true,
  svi_ipm1_lesions_ou_motifs: true,
  svi_ipm1_nombre_animaux: true,
  svi_ipm1_commentaire: true,
  svi_ipm1_decision: true,
  svi_ipm1_duree_consigne: true,
  svi_ipm1_poids_consigne: true,
  svi_ipm1_signed_at: true,
  svi_ipm2_date: true,
  svi_ipm2_presentee_inspection: true,
  svi_ipm2_user_id: true,
  svi_ipm2_user_name_cache: true,
  svi_ipm2_protocole: true,
  svi_ipm2_pieces: true,
  svi_ipm2_lesions_ou_motifs: true,
  svi_ipm2_nombre_animaux: true,
  svi_ipm2_commentaire: true,
  svi_ipm2_decision: true,
  svi_ipm2_traitement_assainissant: true,
  svi_ipm2_traitement_assainissant_cuisson_temps: true,
  svi_ipm2_traitement_assainissant_cuisson_temp: true,
  svi_ipm2_traitement_assainissant_congelation_temps: true,
  svi_ipm2_traitement_assainissant_congelation_temp: true,
  svi_ipm2_traitement_assainissant_type: true,
  svi_ipm2_traitement_assainissant_paramètres: true,
  svi_ipm2_traitement_assainissant_etablissement: true,
  svi_ipm2_traitement_assainissant_poids: true,
  svi_ipm2_poids_saisie: true,
  svi_ipm2_signed_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  is_synced: true,
  Fei: {
    select: {
      date_mise_a_mort: true,
      commune_mise_a_mort: true,
      heure_mise_a_mort_premiere_carcasse: true,
      heure_evisceration_derniere_carcasse: true,
      // created_by_user_id: false,
      // resume_nombre_de_carcasses: true,
      // examinateur_initial_offline: false,
      // examinateur_initial_user_id: false,
      // examinateur_initial_approbation_mise_sur_le_marche: false,
      examinateur_initial_date_approbation_mise_sur_le_marche: true,
      // premier_detenteur_offline: false,
      // premier_detenteur_user_id: false,
      // premier_detenteur_entity_id: false,
      premier_detenteur_name_cache: true,
      premier_detenteur_depot_ccg_at: true,
      // premier_detenteur_depot_entity_id: false,
      // premier_detenteur_depot_type: false,
      svi_assigned_at: true,
      svi_entity_id: true,
      svi_user_id: true,
      svi_carcasses_saisies: true,
      svi_signed_at: true,
      svi_signed_by: true,
      // fei_current_owner_user_id: false,
      // fei_current_owner_user_name_cache: false,
      // fei_current_owner_entity_id: false,
      // fei_current_owner_entity_name_cache: false,
      // fei_current_owner_role: false,
      // fei_current_owner_wants_to_transfer: false,
      // fei_next_owner_user_id: false,
      // fei_next_owner_user_name_cache: false,
      // fei_next_owner_entity_id: false,
      // fei_next_owner_entity_name_cache: false,
      // fei_next_owner_role: false,
      // fei_prev_owner_user_id: false,
      // fei_prev_owner_entity_id: false,
      // fei_prev_owner_role: false,
      created_at: true,
      updated_at: true,
      deleted_at: true,
      is_synced: true,
      automatic_closed_at: true,
    },
  },
} as const;

export type CarcasseGetForRegistry = Prisma.CarcasseGetPayload<{
  select: typeof carcasseForRegistrySelect;
}>;

export type CarcasseForResponseForRegistry = Omit<CarcasseGetForRegistry, 'Fei'> & {
  svi_carcasse_status: CarcasseStatus;
  svi_carcasse_status_set_at: Date | null;
  svi_assigned_to_fei_at: Date | null;
  svi_carcasse_archived: boolean | null;
  fei_date_mise_a_mort: Fei['date_mise_a_mort'];
  fei_commune_mise_a_mort: Fei['commune_mise_a_mort'];
  fei_heure_mise_a_mort_premiere_carcasse: Fei['heure_mise_a_mort_premiere_carcasse'];
  fei_heure_evisceration_derniere_carcasse: Fei['heure_evisceration_derniere_carcasse'];
  // fei_resume_nombre_de_carcasses: Fei['resume_nombre_de_carcasses'];
  fei_examinateur_initial_date_approbation_mise_sur_le_marche: Fei['examinateur_initial_date_approbation_mise_sur_le_marche'];
  fei_premier_detenteur_name_cache: Fei['premier_detenteur_name_cache'];
  fei_svi_assigned_at: Fei['svi_assigned_at'];
  fei_svi_entity_id: Fei['svi_entity_id'];
  fei_svi_user_id: Fei['svi_user_id'];
  fei_svi_signed_at: Fei['svi_signed_at'];
  fei_svi_signed_by: Fei['svi_signed_by'];
  fei_created_at: Fei['created_at'];
  fei_updated_at: Fei['updated_at'];
  fei_deleted_at: Fei['deleted_at'];
  fei_automatic_closed_at: Fei['automatic_closed_at'];
};
