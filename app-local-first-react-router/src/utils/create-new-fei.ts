import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { createHistoryInput } from './create-history-entry';

export async function createNewFei(): Promise<FeiWithIntermediaires> {
  const user = useUser.getState().user;
  if (!user?.id) {
    throw new Error('No user found');
  }
  if (!user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    throw new Error('Forbidden');
  }
  const newFeiNumero = `ZACH-${dayjs().format('YYYYMMDD')}-${user.id}-${dayjs().format('HHmmss')}`;

  const newFei: FeiWithIntermediaires = {
    id: Date.now(),
    numero: newFeiNumero,
    date_mise_a_mort: null,
    commune_mise_a_mort: null,
    heure_mise_a_mort_premiere_carcasse: null,
    heure_evisceration_derniere_carcasse: null,
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
    premier_detenteur_depot_ccg_at: null,
    premier_detenteur_transport_type: null,
    premier_detenteur_transport_date: null,
    premier_detenteur_prochain_detenteur_type_cache: null,
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
    fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
    fei_current_owner_wants_to_transfer: null,
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
    user_role: UserRoles.EXAMINATEUR_INITIAL,
    fei_numero: newFei.numero,
    action: 'examinateur-create-fei',
    entity_id: null,
    history: createHistoryInput(null, newFei),
    zacharie_carcasse_id: null,
    intermediaire_id: null,
    carcasse_intermediaire_id: null,
  });
  if (import.meta.env.VITE_TEST_PLAYWRIGHT === 'true') {
    // if it goes too fast, we have a race condition with the sync with the backend and PG doesn'tlike it
    // again, "cache lookup failed for type" problem
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return newFei;
}
