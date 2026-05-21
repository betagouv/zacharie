import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from './load-my-relations';
import { useEffect, useRef } from 'react';
import { syncData } from '@app/utils/sync-data';

export async function loadData(from?: string) {
  return refreshUser(from)
    .then(() => syncData(from))
    .then(loadMyRelations);
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
