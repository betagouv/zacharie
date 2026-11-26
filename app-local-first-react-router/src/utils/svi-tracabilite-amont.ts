import { useEffect, useState } from 'react';
import API from '@app/services/api';
import type { SviTracabiliteAmont, SviTracabiliteAmontResponse } from '@api/src/types/responses';

export function useSviTracabiliteAmont() {
  const [amont, setAmont] = useState<SviTracabiliteAmont | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.get({ path: 'svi/tracabilite-amont' })
      .then((res) => res as SviTracabiliteAmontResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setAmont(res.data.amont);
        } else {
          setAmont(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { amont, loading };
}
