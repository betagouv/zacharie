import type { Carcasse } from '@prisma/client';
import dayjs from 'dayjs';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import useZustandStore from '../store';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { mapFeiFieldsToCarcasse } from '@app/utils/map-fei-fields-to-carcasse';

export function updateFei(
  fei_numero: FeiWithIntermediaires['numero'],
  partialFei: Partial<FeiWithIntermediaires>,
) {
  console.log('updateFei', fei_numero, JSON.stringify(partialFei, null, 2));
  const carcassefeiCarcasses = filterCarcassesForFei(useZustandStore.getState().carcasses, fei_numero);
  const countCarcassesByEspece = formatCountCarcasseByEspece(carcassefeiCarcasses);
  const nextFei: FeiWithIntermediaires = {
    ...useZustandStore.getState().feis[fei_numero],
    ...partialFei,
    resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
    updated_at: dayjs().toDate(),
    is_synced: false,
  };

  const nextCarcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
  for (const carcasse of carcassefeiCarcasses) {
    nextCarcasses[carcasse.zacharie_carcasse_id] = {
      ...carcasse,
      ...mapFeiFieldsToCarcasse(nextFei, carcasse),
      updated_at: dayjs().toDate(),
      is_synced: false,
    };
  }

  useZustandStore.setState((state) => ({
    feis: {
      ...state.feis,
      [fei_numero]: nextFei,
    },
    carcasses: {
      ...state.carcasses,
      ...nextCarcasses,
    },
    dataIsSynced: false,
  }));
}
