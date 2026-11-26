import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';

export function useCarcassesRegistry() {
  const carcasses = useZustandStore((state) => state.carcasses);
  return useMemo(() => Object.values(carcasses).filter((c) => !c.deleted_at), [carcasses]);
}
