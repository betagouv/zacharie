import type { Carcasse } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '../store';
import { updateFei } from './update-fei';

export function createCarcasse(newCarcasse: Carcasse) {
  newCarcasse.is_synced = false;
  newCarcasse.updated_at = dayjs().toDate();

  useZustandStore.setState((state) => {
    return {
      ...state,
      carcasses: {
        ...state.carcasses,
        [newCarcasse.zacharie_carcasse_id]: newCarcasse,
      },
      dataIsSynced: false,
    };
  });
  updateFei(newCarcasse.fei_numero, { updated_at: dayjs().toDate() });
}
