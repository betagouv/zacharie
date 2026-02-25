import type { Carcasse } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '../store';
import updateCarcasseStatus from '@app/utils/get-carcasse-status';
import { updateFei } from './update-fei';

export function updateCarcasse(
  zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
  partialCarcasse: Partial<Carcasse>,
  shouldUpdateFei: boolean,
) {
  const carcasses = useZustandStore.getState().carcasses;
  console.log('NOT SYNCED 1');
  const nextCarcasse = {
    ...carcasses[zacharie_carcasse_id],
    ...partialCarcasse,
    updated_at: dayjs().toDate(),
    is_synced: false,
  };
  const nextStatus = updateCarcasseStatus(nextCarcasse);
  if (nextStatus !== nextCarcasse.svi_carcasse_status) {
    nextCarcasse.svi_carcasse_status = nextStatus;
    nextCarcasse.svi_carcasse_status_set_at = dayjs().toDate();
  }

  useZustandStore.setState({
    carcasses: {
      ...carcasses,
      [zacharie_carcasse_id]: nextCarcasse,
    },
    dataIsSynced: false,
  });
  if (shouldUpdateFei) {
    updateFei(nextCarcasse.fei_numero, { updated_at: dayjs().toDate() });
  }
}
