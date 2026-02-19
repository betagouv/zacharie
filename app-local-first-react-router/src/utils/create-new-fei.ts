import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore, { syncData } from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { FeiOwnerRole, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { createHistoryInput } from './create-history-entry';

type InitialParamsProps = {
  date_mise_a_mort?: FeiWithIntermediaires['date_mise_a_mort'];
  contexte?: FeiWithIntermediaires['creation_context'];
  commune_mise_a_mort?: FeiWithIntermediaires['commune_mise_a_mort'];
  heure_mise_a_mort_premiere_carcasse?: FeiWithIntermediaires['heure_mise_a_mort_premiere_carcasse'];
  heure_evisceration_derniere_carcasse?: FeiWithIntermediaires['heure_evisceration_derniere_carcasse'];
};

export async function createNewFei(props?: InitialParamsProps): Promise<FeiWithIntermediaires> {
  const user = useUser.getState().user;
  if (!user?.id) {
    throw new Error('No user found');
  }
  const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
  if (!isExaminateurInitial) {
    throw new Error('Forbidden');
  }
  const newFeiNumero = `ZACH-${dayjs().format('YYYYMMDD')}-${user.id}-${dayjs().format('HHmmss')}`;

  const newFei: FeiWithIntermediaires = {
    id: Date.now(),
    creation_context: props?.contexte ?? null,
    numero: newFeiNumero,
    date_mise_a_mort: props?.date_mise_a_mort ?? null,
    commune_mise_a_mort: props?.commune_mise_a_mort ?? null,
    heure_mise_a_mort_premiere_carcasse: props?.heure_mise_a_mort_premiere_carcasse ?? null,
    heure_evisceration_derniere_carcasse: props?.heure_evisceration_derniere_carcasse ?? null,
    created_by_user_id: user.id,
    automatic_closed_at: null,
    resume_nombre_de_carcasses: null,
    examinateur_initial_offline: navigator.onLine ? false : true,
    examinateur_initial_user_id: user.id,
    examinateur_initial_approbation_mise_sur_le_marche: null,
    examinateur_initial_date_approbation_mise_sur_le_marche: null,
    premier_detenteur_offline: null,
    premier_detenteur_user_id: null,
    premier_detenteur_entity_id: null,
    premier_detenteur_name_cache: null,
    premier_detenteur_depot_type: null,
    premier_detenteur_depot_entity_id: null,
    premier_detenteur_depot_entity_name_cache: null,
    premier_detenteur_depot_ccg_at: null,
    premier_detenteur_transport_type: null,
    premier_detenteur_transport_date: null,
    premier_detenteur_prochain_detenteur_role_cache: null,
    premier_detenteur_prochain_detenteur_id_cache: null,
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
    fei_current_owner_user_id: user.id,
    fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
    fei_current_owner_entity_id: null,
    fei_current_owner_entity_name_cache: null,
    fei_current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    fei_next_owner_wants_to_sous_traite: null,
    fei_next_owner_sous_traite_at: null,
    fei_next_owner_sous_traite_by_user_id: null,
    fei_next_owner_sous_traite_by_entity_id: null,
    fei_next_owner_user_id: null,
    fei_next_owner_user_name_cache: null,
    fei_next_owner_entity_id: null,
    fei_next_owner_entity_name_cache: null,
    fei_next_owner_role: null,
    fei_prev_owner_user_id: null,
    fei_prev_owner_entity_id: null,
    fei_prev_owner_role: null,
    created_at: dayjs().toDate(),
    updated_at: dayjs().toDate(),
    deleted_at: null,
    is_synced: false,
    CarcasseIntermediaire: [],
  };
  useZustandStore.getState().createFei(newFei);
  useZustandStore.getState().addLog({
    user_id: user.id,
    user_role: UserRoles.CHASSEUR,
    fei_numero: newFei.numero,
    action: 'examinateur-create-fei',
    entity_id: null,
    history: createHistoryInput(null, newFei),
    zacharie_carcasse_id: null,
    intermediaire_id: null,
    carcasse_intermediaire_id: null,
  });
  syncData('create-new-fei');
  if (import.meta.env.VITE_TEST_PLAYWRIGHT === 'true') {
    // if it goes too fast, we have a race condition with the sync with the backend and PG doesn'tlike it
    // again, "cache lookup failed for type" problem
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return newFei;
}
