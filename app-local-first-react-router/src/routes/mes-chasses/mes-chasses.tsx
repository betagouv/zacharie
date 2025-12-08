import { useEffect, useState } from 'react';
import TotalCarcassesCard from './components/TotalCarcassesCard';
import CarcassBreakdownCard from './components/CarcassBreakdownCard';
import HygieneScoreCard from './components/HygieneScoreCard';
import RefusalCausesCard from './components/RefusalCausesCard';
import SeizureRateCard from './components/SeizureRateCard';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';

interface DashboardData {
  totalCarcasses: number;
  season: string;
  bigGame: number;
  smallGame: number;
  hygieneScore: number;
  refusalCauses: Array<{ label: string; count: number }>;
  personalSeizureRate: number;
  nationalSeizureRate: number;
}

interface DashboardResponse {
  ok: boolean;
  data?: DashboardData;
  error?: string;
}

export default function MesChasses() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = (await API.get({
          path: '/stats/mes-chasses',
        })) as DashboardResponse;

        if (response.ok && response.data) {
          setDashboardData(response.data);
        } else {
          setError(response.error || 'Erreur lors du chargement des données');
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <Chargement />;
  }

  if (error || !dashboardData) {
    return (
      <div className="fr-container fr-container--fluid min-h-screen">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 p-4 md:p-0">
            <div className="fr-alert fr-alert--error">
              <p>{error || 'Aucune donnée disponible'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fr-container fr-container--fluid min-h-screen">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
        <div className="fr-col-12 p-4 md:p-0">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <TotalCarcassesCard total={dashboardData.totalCarcasses} season={dashboardData.season} />
            <CarcassBreakdownCard bigGame={dashboardData.bigGame} smallGame={dashboardData.smallGame} />
            <HygieneScoreCard score={dashboardData.hygieneScore} />
            <RefusalCausesCard causes={dashboardData.refusalCauses} />
            <SeizureRateCard
              rate={dashboardData.personalSeizureRate}
              label="taux de saisie personnel grand gibier"
            />
            <SeizureRateCard
              rate={dashboardData.nationalSeizureRate}
              label="taux de saisie national en 2024"
              isNational
            />
          </div>
        </div>
      </div>
    </div>
  );
}
