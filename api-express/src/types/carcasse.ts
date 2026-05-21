import { Carcasse, CarcasseModificationRequest, Prisma } from '@prisma/client';

export const carcasseForApiSelect: Prisma.CarcasseSelect = {
  // zacharie_carcasse_id: false,
  numero_bracelet: true,
  fei_numero: true,
  espece: true,
  type: true,
  nombre_d_animaux: true,
  heure_mise_a_mort: true,
  heure_evisceration: true,
  /**
   * EXAMINATEUR
   */
  examinateur_carcasse_sans_anomalie: true,
  examinateur_anomalies_carcasse: true,
  examinateur_anomalies_abats: true,
  examinateur_commentaire: true,
  examinateur_signed_at: true,
  /**
   * PREMIER DETENTEUR
   * duplicatas des champs de Fei
   * anticipation des circuits courts où on pourra envoyer des carcasses éparpillées, d'un même examen initial,
   */
  premier_detenteur_depot_type: true, // CCG, ETG, AUCUN
  // premier_detenteur_depot_entity_id: false,
  premier_detenteur_depot_ccg_at: true,
  premier_detenteur_transport_type: true,
  premier_detenteur_transport_date: true,
  premier_detenteur_prochain_detenteur_role_cache: true,
  // premier_detenteur_prochain_detenteur_id_cache: false,
  /**
   * INTERMEDIAIRE
   */
  // intermediaire_carcasse_refus_intermediaire_id: false,
  intermediaire_carcasse_refus_motif: true,
  intermediaire_carcasse_manquante: true,
  latest_intermediaire_signed_at: true,
  /**
   * SVI
   */
  svi_assigned_to_fei_at: true, // same as svi_assigned_at in fei
  svi_carcasse_commentaire: true, // cache of ipm1 and ipm2 comments
  svi_carcasse_status: true,
  svi_carcasse_status_set_at: true,
  /**
   * SVI IPM1
   */
  svi_ipm1_date: true,
  svi_ipm1_presentee_inspection: true,
  // svi_ipm1_user_id: false,
  // svi_ipm1_user_name_cache: false,
  svi_ipm1_protocole: true,
  svi_ipm1_pieces: true,
  svi_ipm1_lesions_ou_motifs: true,
  svi_ipm1_nombre_animaux: true,
  svi_ipm1_commentaire: true,
  svi_ipm1_decision: true,
  svi_ipm1_duree_consigne: true,
  svi_ipm1_poids_consigne: true,
  svi_ipm1_poids_type: true,
  svi_ipm1_signed_at: true,
  /**
   * SVI IPM2
   */
  svi_ipm2_date: true,
  svi_ipm2_presentee_inspection: true,
  // svi_ipm2_user_id: false,
  // svi_ipm2_user_name_cache: false,
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
  svi_ipm2_poids_type: true,
  svi_ipm2_signed_at: true,
  created_at: true,
  updated_at: true,
  date_mise_a_mort: true,
  // CarcasseCertificats: false,
  // SviIpm1User: false,
  // CarcasseIntermediaire: false,
} as const;

export type CarcasseGetForApi = Prisma.CarcasseGetPayload<{
  select: typeof carcasseForApiSelect;
}>;

export type CarcasseWithModificationRequests = Carcasse & {
  CarcasseModificationRequests: Array<CarcasseModificationRequest>;
};
