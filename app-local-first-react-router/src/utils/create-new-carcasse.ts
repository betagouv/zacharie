import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
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
    created_at: dayjs().toDate(),
    updated_at: dayjs().toDate(),
    deleted_at: null,
    is_synced: false,
  };
  useZustandStore.getState().createCarcasse(newCarcasse);
  return newCarcasse;
}
