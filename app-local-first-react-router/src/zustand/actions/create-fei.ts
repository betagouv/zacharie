import dayjs from 'dayjs';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import useZustandStore from '../store';

export function createFei(newFei: FeiWithIntermediaires) {
  newFei.is_synced = false;
  newFei.updated_at = dayjs().toDate();
  useZustandStore.setState((state) => ({
    ...state,
    feis: { ...state.feis, [newFei.numero]: newFei },
    dataIsSynced: false,
  }));
}
