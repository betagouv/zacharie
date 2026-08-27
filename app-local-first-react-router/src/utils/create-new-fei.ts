import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import useUser from '@app/zustand/user';
import { Fei, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { createHistoryInput } from './create-history-entry';

type InitialParamsProps = {
  date_mise_a_mort?: Fei['date_mise_a_mort'];
  contexte?: Fei['creation_context'];
  commune_mise_a_mort?: Fei['commune_mise_a_mort'];
  heure_mise_a_mort_premiere_carcasse?: Fei['heure_mise_a_mort_premiere_carcasse'];
  heure_evisceration_derniere_carcasse?: Fei['heure_evisceration_derniere_carcasse'];
};

export async function createNewFei(props?: InitialParamsProps): Promise<Fei> {
  const user = useUser.getState().user;
  if (!user?.id) {
    throw new Error('No user found');
  }
  const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
  if (!isExaminateurInitial) {
    throw new Error('Forbidden');
  }
  const newFeiNumero = `ZACH-${dayjs().format('YYYYMMDD')}-${user.id}-${dayjs().format('HHmmss')}`;

  const newFei: Fei = {
    id: Date.now(),
    creation_context: props?.contexte ?? null,
    numero: newFeiNumero,
    date_mise_a_mort: props?.date_mise_a_mort ?? null,
    commune_mise_a_mort: props?.commune_mise_a_mort ?? null,
    heure_mise_a_mort_premiere_carcasse: props?.heure_mise_a_mort_premiere_carcasse ?? null,
    heure_evisceration_derniere_carcasse: props?.heure_evisceration_derniere_carcasse ?? null,
    created_by_user_id: user.id,
    resume_nombre_de_carcasses: null,
    examinateur_initial_offline: navigator.onLine ? false : true,
    examinateur_initial_user_id: user.id,
    examinateur_initial_approbation_mise_sur_le_marche: null,
    examinateur_initial_date_approbation_mise_sur_le_marche: null,
    consommateur_final_usage_domestique: null,
    premier_detenteur_offline: null,
    premier_detenteur_user_id: null,
    premier_detenteur_entity_id: null,
    premier_detenteur_name_cache: null,
    created_at: dayjs().toDate(),
    updated_at: dayjs().toDate(),
    deleted_at: null,
    is_synced: false,
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
