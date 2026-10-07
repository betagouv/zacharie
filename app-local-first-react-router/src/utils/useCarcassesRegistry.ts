import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';

// Liste des carcasses non supprimées, dérivée du registre vivant (state.carcasses) : elle suit les
// mutations locales, hors ligne comprises, et n'est recalculée que quand state.carcasses change.
export function useCarcassesRegistry() {
  const carcasses = useZustandStore((state) => state.carcasses);
  return useMemo(() => Object.values(carcasses).filter((c) => !c.deleted_at), [carcasses]);
}
