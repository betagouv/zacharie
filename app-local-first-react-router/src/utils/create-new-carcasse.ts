import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
import { createCarcasse } from '@app/zustand/actions/create-carcasse';
import useUser from '@app/zustand/user';
import { Carcasse, CarcasseStatus, CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import petitGibier from '@app/data/petit-gibier.json';

type InitialParamsProps = {
  zacharieCarcasseId: string;
  numeroBracelet: string;
  espece: string;
  nombreDAnimaux: string;
  fei: FeiWithIntermediaires;
};

export async function createNewCarcasse({
  zacharieCarcasseId,
  numeroBracelet,
  espece,
  nombreDAnimaux,
  fei,
}: InitialParamsProps): Promise<Carcasse> {
  const user = useUser.getState().user;
  if (!user?.id) {
    throw new Error('No user found');
  }
  const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
  if (!isExaminateurInitial) {
    throw new Error('Forbidden');
  }
  const carcasses = useZustandStore.getState().carcasses;
  if (!numeroBracelet) {
    throw new Error("Veuillez renseigner le numéro de marquage avant d'enregistrer la carcasse");
  }
  if (!espece) {
    throw new Error("Veuillez renseigner l'espèce du gibier avant d'enregistrer la carcasse");
  }
  if (carcasses[zacharieCarcasseId] && !carcasses[zacharieCarcasseId].deleted_at) {
    throw new Error('Le numéro de marquage est déjà utilisé pour cette fiche');
  }
  const isPetitGibier = petitGibier.especes.includes(espece);
  const newCarcasse: Carcasse = {
    zacharie_carcasse_id: zacharieCarcasseId,
    numero_bracelet: numeroBracelet,
    fei_numero: fei.numero,
    date_mise_a_mort: fei.date_mise_a_mort,
    type: isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER,
    nombre_d_animaux: isPetitGibier ? Number(nombreDAnimaux) : 1,
    heure_mise_a_mort_premiere_carcasse_fei: fei.heure_mise_a_mort_premiere_carcasse,
    heure_evisceration_derniere_carcasse_fei: fei.heure_evisceration_derniere_carcasse,
    heure_mise_a_mort: null,
    heure_evisceration: null,
    espece: espece,
    examinateur_carcasse_sans_anomalie: null,
    examinateur_anomalies_carcasse: [],
    examinateur_anomalies_abats: [],
    examinateur_commentaire: null,
    examinateur_signed_at: dayjs().toDate(),
    premier_detenteur_depot_type: null,
    premier_detenteur_depot_entity_id: null,
    premier_detenteur_depot_entity_name_cache: null,
    premier_detenteur_depot_ccg_at: null,
    premier_detenteur_transport_type: null,
    premier_detenteur_transport_date: null,
    premier_detenteur_prochain_detenteur_role_cache: null,
    premier_detenteur_prochain_detenteur_id_cache: null,
    intermediaire_carcasse_refus_intermediaire_id: null,
    intermediaire_carcasse_refus_motif: null,
    latest_intermediaire_signed_at: null,
    intermediaire_carcasse_manquante: false,
    svi_assigned_to_fei_at: null,
    svi_carcasse_commentaire: null, // cache of ipm1 and ipm2 comments
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    svi_carcasse_status_set_at: null,
    svi_ipm1_presentee_inspection: null,
    svi_ipm1_date: null,
    svi_ipm1_user_id: null,
    svi_ipm1_user_name_cache: null,
    svi_ipm1_protocole: null,
    svi_ipm1_pieces: [],
    svi_ipm1_lesions_ou_motifs: [],
    svi_ipm1_nombre_animaux: null,
    svi_ipm1_commentaire: null,
    svi_ipm1_decision: null,
    svi_ipm1_duree_consigne: null,
    svi_ipm1_poids_consigne: null,
    svi_ipm1_poids_type: null,
    svi_ipm1_signed_at: null,
    svi_ipm2_date: null,
    svi_ipm2_presentee_inspection: null,
    svi_ipm2_user_id: null,
    svi_ipm2_user_name_cache: null,
    svi_ipm2_protocole: null,
    svi_ipm2_pieces: [],
    svi_ipm2_lesions_ou_motifs: [],
    svi_ipm2_nombre_animaux: null,
    svi_ipm2_commentaire: null,
    svi_ipm2_decision: null,
    svi_ipm2_traitement_assainissant: [],
    svi_ipm2_traitement_assainissant_cuisson_temps: null,
    svi_ipm2_traitement_assainissant_cuisson_temp: null,
    svi_ipm2_traitement_assainissant_congelation_temps: null,
    svi_ipm2_traitement_assainissant_congelation_temp: null,
    svi_ipm2_traitement_assainissant_type: null,
    svi_ipm2_traitement_assainissant_paramètres: null,
    svi_ipm2_traitement_assainissant_etablissement: null,
    svi_ipm2_traitement_assainissant_poids: null,
    svi_ipm2_poids_saisie: null,
    svi_ipm2_poids_type: null,
    svi_ipm2_signed_at: null,
    created_by_user_id: user.id,
    examinateur_initial_offline: fei.examinateur_initial_offline,
    examinateur_initial_user_id: fei.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    premier_detenteur_offline: null,
    premier_detenteur_user_id: null,
    premier_detenteur_entity_id: null,
    premier_detenteur_name_cache: null,
    intermediaire_closed_at: null,
    intermediaire_closed_by_user_id: null,
    intermediaire_closed_by_entity_id: null,
    latest_intermediaire_user_id: null,
    latest_intermediaire_entity_id: null,
    latest_intermediaire_name_cache: null,
    svi_assigned_at: null,
    svi_entity_id: null,
    svi_user_id: null,
    svi_closed_at: null,
    svi_closed_by_user_id: null,
    current_owner_user_id: fei.fei_current_owner_user_id,
    current_owner_user_name_cache: fei.fei_current_owner_user_name_cache,
    current_owner_entity_id: fei.fei_current_owner_entity_id,
    current_owner_entity_name_cache: fei.fei_current_owner_entity_name_cache,
    current_owner_role: fei.fei_current_owner_role,
    next_owner_wants_to_sous_traite: fei.fei_next_owner_wants_to_sous_traite,
    next_owner_sous_traite_at: fei.fei_next_owner_sous_traite_at,
    next_owner_sous_traite_by_user_id: fei.fei_next_owner_sous_traite_by_user_id,
    next_owner_sous_traite_by_entity_id: fei.fei_next_owner_sous_traite_by_entity_id,
    next_owner_user_id: fei.fei_next_owner_user_id,
    next_owner_user_name_cache: fei.fei_next_owner_user_name_cache,
    next_owner_entity_id: fei.fei_next_owner_entity_id,
    next_owner_entity_name_cache: fei.fei_next_owner_entity_name_cache,
    next_owner_role: fei.fei_next_owner_role,
    prev_owner_user_id: fei.fei_prev_owner_user_id,
    prev_owner_entity_id: fei.fei_prev_owner_entity_id,
    prev_owner_role: fei.fei_prev_owner_role,
    created_at: dayjs().toDate(),
    updated_at: dayjs().toDate(),
    deleted_at: null,
    is_synced: false,
  };
  createCarcasse(newCarcasse);
  return newCarcasse;
}
