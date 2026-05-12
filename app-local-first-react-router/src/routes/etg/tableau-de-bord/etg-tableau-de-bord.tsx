import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import KpiCard from '@app/components/dashboard/KpiCard';
import VolumeCard from '@app/components/dashboard/VolumeCard';
import EspeceBreakdownCard from '@app/components/dashboard/EspeceBreakdownCard';
import { trackEvent } from '@app/services/matomo';

interface EtgStats {
  toAccept: number;
  ongoing: number;
  volume7d: number;
  volume30d: number;
  carcassesByEspece: { gros: number; petit: number };
}

interface EtgStatsResponse {
  ok: boolean;
  data?: EtgStats;
  error?: string;
}

export default function EtgTableauDeBord() {
  const [stats, setStats] = useState<EtgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent('Dashboard', 'open', 'etg');
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = (await API.get({ path: '/stats/etg' })) as EtgStatsResponse;
        if (response.ok && response.data) {
          setStats(response.data);
        } else {
          setError(response.error || 'Erreur lors du chargement des données');
        }
      } catch {
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Chargement />;

  if (error || !stats) {
    return (
      <div className="fr-container fr-container--fluid min-h-screen">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Alert
              severity="error"
              title="Erreur"
              description={error || 'Aucune donnée disponible'}
            />
          </div>
        </div>
      </div>
    );
  }

  const totalActive = stats.toAccept + stats.ongoing;

  return (
    <div className="fr-container fr-container--fluid">
      <title>Tableau de bord | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center py-4">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 text-action-high-blue-france-light mb-6">Tableau de bord</h1>

          {totalActive === 0 && stats.volume30d === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center">
              <h2 className="fr-h4 mb-3 font-bold text-gray-800">Pas encore d'activité</h2>
              <p className="fr-text--regular max-w-md">
                Vos indicateurs apparaîtront ici dès que des fiches seront en circulation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <KpiCard
                  value={stats.toAccept}
                  label="Fiches à accepter"
                  sublabel="en attente de prise en charge"
                  accent="orange"
                  iconId="fr-icon-inbox-archive-line"
                />
                <KpiCard
                  value={stats.ongoing}
                  label="Fiches en cours"
                  sublabel="prises en charge, non transmises au SVI"
                  accent="blue"
                  iconId="fr-icon-refresh-line"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <VolumeCard
                  title="Fiches prises en charge"
                  volume7d={stats.volume7d}
                  volume30d={stats.volume30d}
                  accent="purple"
                  iconId="fr-icon-bar-chart-box-line"
                />
                <EspeceBreakdownCard
                  gros={stats.carcassesByEspece.gros}
                  petit={stats.carcassesByEspece.petit}
                  accent="green"
                  iconId="fr-icon-pie-chart-2-line"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
