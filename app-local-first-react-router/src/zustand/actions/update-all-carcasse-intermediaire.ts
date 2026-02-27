import type { Fei, CarcasseIntermediaire } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '../store';
import { getFeiAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';

export function updateAllCarcasseIntermediaire(
  _fei_numero: Fei['numero'],
  feiAndIntermediaireIds: FeiAndIntermediaireIds,
  nextCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
) {
  const carcassesIntermediaireById = useZustandStore.getState().carcassesIntermediaireById;
  const nextCarcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
  const matchingEntries = Object.entries(carcassesIntermediaireById).filter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ([_id, ci]) => getFeiAndIntermediaireIds(ci) === feiAndIntermediaireIds,
  );
  for (const [carcassesIntermediaireId, carcassesIntermediaire] of matchingEntries) {
    if (!carcassesIntermediaire.prise_en_charge) continue;
    nextCarcassesIntermediaireById[carcassesIntermediaireId as FeiAndCarcasseAndIntermediaireIds] = {
      ...carcassesIntermediaire,
      ...nextCarcasseIntermediaire,
      updated_at: dayjs().toDate(),
      is_synced: false,
    };
  }

  useZustandStore.setState((state) => {
    return {
      ...state,
      carcassesIntermediaireById: {
        ...state.carcassesIntermediaireById,
        ...nextCarcassesIntermediaireById,
      },
      dataIsSynced: false,
    };
  });
  // FIXME: pourquoi on n'envoie pas de syncData ici ?
  // explication : parce qu'on fait un syncData après updateFei seulement
  // et qu'on appelle TOUT LE TEMPS updateFei APRÈS updateAllCarcasseIntermediaire
  // à vérifier toutefois : que c'est bien la dernière version du store
  // qui est envoyée
}
