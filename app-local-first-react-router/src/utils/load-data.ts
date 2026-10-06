import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from './load-my-relations';
import { useEffect, useRef } from 'react';
import { syncData } from '@app/utils/sync-data';

export async function loadData(from?: string) {
  // les relations avant les fiches : les libellés ETG ont besoin des entités pour lesquelles l'utilisateur travaille
  return refreshUser(from)
    .then(loadMyRelations)
    .then(() => syncData(from));
}

export function useLoaderEffect(loader: () => void, deps: React.DependencyList = []) {
  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    loader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
