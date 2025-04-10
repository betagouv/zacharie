import useZustandStore from '@app/zustand/store';
import { useMemo } from 'react';
import dayjs from 'dayjs';

export default function useGetCommunesDeChasseFavorites(compute: boolean = true) {
  const feis = useZustandStore((state) => state.feis);

  const villesFavorites = useMemo(() => {
    if (!compute) {
      return [];
    }
    const villesFavorites = [
      ...new Set(
        Object.values(feis)
          .sort((a, b) => {
            if (!a.date_mise_a_mort || !b.date_mise_a_mort) {
              return 0;
            }
            return dayjs(a.date_mise_a_mort).diff(dayjs(b.date_mise_a_mort));
          })
          .map((fei) => fei.commune_mise_a_mort)
          .filter(Boolean)
          .slice(0, 5),
      ),
    ];
    return villesFavorites;
  }, [feis, compute]);

  return villesFavorites;
}
