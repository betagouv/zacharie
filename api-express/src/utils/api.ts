import { CarcasseGetForApi } from '~/types/carcasse';

export function mapCarcasseForApi(carcasse: CarcasseGetForApi) {
  if (!carcasse) {
    return null;
  }
  return {
    numero_bracelet: carcasse.numero_bracelet,
    fei_numero: carcasse.fei_numero,
    espece: carcasse.espece,
    type: carcasse.type,
    nombre_d_animaux: carcasse.nombre_d_animaux,
    heure_mise_a_mort: carcasse.heure_mise_a_mort,
    heure_evisceration: carcasse.heure_evisceration,
    examinateur_name:
      carcasse.Fei.FeiExaminateurInitialUser.prenom +
      ' ' +
      carcasse.Fei.FeiExaminateurInitialUser.nom_de_famille,
    examinateur_carcasse_sans_anomalie: carcasse.examinateur_carcasse_sans_anomalie,
    examinateur_anomalies_carcasse: carcasse.examinateur_anomalies_carcasse,
    examinateur_anomalies_abats: carcasse.examinateur_anomalies_abats,
    examinateur_commentaire: carcasse.examinateur_commentaire,
    examinateur_signed_at: carcasse.examinateur_signed_at,
    premier_detenteur_name:
      carcasse.Fei.FeiPremierDetenteurUser.prenom + ' ' + carcasse.Fei.FeiPremierDetenteurUser.nom_de_famille,
    premier_detenteur_depot_type: carcasse.premier_detenteur_depot_type,
    premier_detenteur_depot_ccg_at: carcasse.premier_detenteur_depot_ccg_at,
    premier_detenteur_transport_type: carcasse.premier_detenteur_transport_type,
    premier_detenteur_transport_date: carcasse.premier_detenteur_transport_date,
    premier_detenteur_prochain_detenteur_role_cache: carcasse.premier_detenteur_prochain_detenteur_role_cache,
    // premier_detenteur_prochain_detenteur_name: carcasse.Fei.pro
    // latest_intermediaire_name
    // latest_intermediaire_poids_carcasse
    latest_intermediaire_carcasse_refus_motif: carcasse.intermediaire_carcasse_refus_motif,
    latest_intermediaire_carcasse_manquante: carcasse.intermediaire_carcasse_manquante,
    latest_intermediaire_decision_at: carcasse.latest_intermediaire_signed_at,
    latest_intermediaire_prise_en_charge_at: carcasse.latest_intermediaire_signed_at,
    svi_assigned_to_fei_at: carcasse.svi_assigned_to_fei_at,
    carcasse_status: carcasse.svi_carcasse_status,
    carcasse_status_set_at: carcasse.svi_carcasse_status_set_at,
    svi_ipm1_date: carcasse.svi_ipm1_date,
    svi_ipm1_presentee_inspection: carcasse.svi_ipm1_presentee_inspection,
    svi_ipm1_protocole: carcasse.svi_ipm1_protocole,
    svi_ipm1_pieces: carcasse.svi_ipm1_pieces,
    svi_ipm1_lesions_ou_motifs: carcasse.svi_ipm1_lesions_ou_motifs,
    svi_ipm1_nombre_animaux: carcasse.svi_ipm1_nombre_animaux,
    svi_ipm1_commentaire: carcasse.svi_ipm1_commentaire,
    svi_ipm1_decision: carcasse.svi_ipm1_decision,
    svi_ipm1_duree_consigne: carcasse.svi_ipm1_duree_consigne,
    svi_ipm1_poids_consigne: carcasse.svi_ipm1_poids_consigne,
    svi_ipm1_poids_type: carcasse.svi_ipm1_poids_type,
    svi_ipm1_signed_at: carcasse.svi_ipm1_signed_at,
    svi_ipm2_date: carcasse.svi_ipm2_date,
    svi_ipm2_presentee_inspection: carcasse.svi_ipm2_presentee_inspection,
    svi_ipm2_protocole: carcasse.svi_ipm2_protocole,
    svi_ipm2_pieces: carcasse.svi_ipm2_pieces,
    svi_ipm2_lesions_ou_motifs: carcasse.svi_ipm2_lesions_ou_motifs,
    svi_ipm2_nombre_animaux: carcasse.svi_ipm2_nombre_animaux,
    svi_ipm2_commentaire: carcasse.svi_ipm2_commentaire,
    svi_ipm2_decision: carcasse.svi_ipm2_decision,
    svi_ipm2_traitement_assainissant: carcasse.svi_ipm2_traitement_assainissant,
    svi_ipm2_traitement_assainissant_cuisson_temps: carcasse.svi_ipm2_traitement_assainissant_cuisson_temps,
    svi_ipm2_traitement_assainissant_cuisson_temp: carcasse.svi_ipm2_traitement_assainissant_cuisson_temp,
    svi_ipm2_traitement_assainissant_congelation_temps:
      carcasse.svi_ipm2_traitement_assainissant_congelation_temps,
    svi_ipm2_traitement_assainissant_congelation_temp:
      carcasse.svi_ipm2_traitement_assainissant_congelation_temp,
    svi_ipm2_traitement_assainissant_type: carcasse.svi_ipm2_traitement_assainissant_type,
    svi_ipm2_traitement_assainissant_paramètres: carcasse.svi_ipm2_traitement_assainissant_paramètres,
    svi_ipm2_traitement_assainissant_etablissement: carcasse.svi_ipm2_traitement_assainissant_etablissement,
    svi_ipm2_traitement_assainissant_poids: carcasse.svi_ipm2_traitement_assainissant_poids,
    svi_ipm2_poids_saisie: carcasse.svi_ipm2_poids_saisie,
    svi_ipm2_poids_type: carcasse.svi_ipm2_poids_type,
    svi_ipm2_signed_at: carcasse.svi_ipm2_signed_at,
    created_at: carcasse.created_at,
    updated_at: carcasse.updated_at,
    fei_date_mise_a_mort: carcasse.Fei.date_mise_a_mort,
    fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort,
    fei_heure_mise_a_mort_premiere_carcasse: carcasse.Fei.heure_mise_a_mort_premiere_carcasse,
    fei_heure_evisceration_derniere_carcasse: carcasse.Fei.heure_evisceration_derniere_carcasse,
    fei_resume_nombre_de_carcasses: carcasse.Fei.resume_nombre_de_carcasses,
    fei_examinateur_initial_approbation_mise_sur_le_marche:
      carcasse.Fei.examinateur_initial_approbation_mise_sur_le_marche,
    fei_examinateur_initial_date_approbation_mise_sur_le_marche:
      carcasse.Fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    fei_automatic_closed_at: carcasse.Fei.automatic_closed_at,
    fei_intermediaire_closed_at: carcasse.Fei.intermediaire_closed_at,
    fei_svi_assigned_at: carcasse.Fei.svi_assigned_at,
    fei_svi_closed_at: carcasse.Fei.svi_closed_at,
  };
}
