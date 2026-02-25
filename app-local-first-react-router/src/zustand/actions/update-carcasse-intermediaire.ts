import type { CarcasseIntermediaire } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '../store';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/fei-intermediaire';

export function updateCarcasseIntermediaire(
  feiAndCarcasseAndIntermediaireIds: FeiAndCarcasseAndIntermediaireIds,
  partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
) {
  const carcasseIntermediaire =
    useZustandStore.getState().carcassesIntermediaireById[feiAndCarcasseAndIntermediaireIds];

  useZustandStore.setState((state) => {
    return {
      ...state,
      carcassesIntermediaireById: {
        ...state.carcassesIntermediaireById,
        [feiAndCarcasseAndIntermediaireIds]: {
          ...carcasseIntermediaire,
          ...partialCarcasseIntermediaire,
          updated_at: dayjs().toDate(),
          is_synced: false,
        },
      },
      dataIsSynced: false,
    };
  });
}
