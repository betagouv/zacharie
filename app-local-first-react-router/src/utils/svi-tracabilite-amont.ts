import { useEffect, useState } from 'react';
import API from '@app/services/api';
import type { SviTracabiliteAmont, SviTracabiliteAmontResponse } from '@api/src/types/responses';

// Traçabilité amont : volumes (en nombre d'animaux) entre ce qui entre chez les ETG
// rattachés au SVI et ce qui est présenté à l'inspection. Servi hors store local-first
// (les carcasses refusées/manquantes n'ont jamais de svi_assigned_at, donc absentes du store).
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
