import useZustandStore from '@app/zustand/store';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import type { Carcasse } from '@prisma/client';

type TransmissionFields = Partial<
  Pick<
    Carcasse,
    | 'current_owner_user_id'
    | 'current_owner_user_name_cache'
    | 'current_owner_entity_id'
    | 'current_owner_entity_name_cache'
    | 'current_owner_role'
    | 'next_owner_user_id'
    | 'next_owner_user_name_cache'
    | 'next_owner_entity_id'
    | 'next_owner_entity_name_cache'
    | 'next_owner_role'
    | 'next_owner_wants_to_sous_traite'
    | 'next_owner_sous_traite_at'
    | 'next_owner_sous_traite_by_user_id'
    | 'next_owner_sous_traite_by_entity_id'
    | 'prev_owner_user_id'
    | 'prev_owner_entity_id'
    | 'prev_owner_role'
  >
>;

export function updateCarcassesTransmission(fei_numero: string, transmissionFields: TransmissionFields) {
  const state = useZustandStore.getState();
  const carcasses = filterCarcassesForFei(state.carcasses, fei_numero);
  const updateCarcasse = state.updateCarcasse;
  for (const carcasse of carcasses) {
    updateCarcasse(carcasse.zacharie_carcasse_id, transmissionFields, false);
  }
}
