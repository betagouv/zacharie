import { useEffect, useState } from 'react';
import TotalCarcassesCard from './components/TotalCarcassesCard';
import CarcassBreakdownCard from './components/CarcassBreakdownCard';
import HygieneScoreCard from './components/HygieneScoreCard';
import RefusalCausesCard from './components/RefusalCausesCard';
import SeizureRateCard from './components/SeizureRateCard';
import SeizureRateCardPersonal from './components/SeizureRateCardPersonal';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate } from 'react-router';
const environment = import.meta.env.VITE_ENV;

interface DashboardData {
  totalCarcasses: number;
  season: string;
  bigGame: number;
  smallGame: number;
  hygieneScore: number | null;
  refusalCauses: Array<{ label: string; count: number }>;
  personalSeizureRate: number | null;
  nationalSeizureRate: number;
}

interface DashboardResponse {
  ok: boolean;
  data?: DashboardData;
  error?: string;
}

export default function MesChasses() {
  if (environment === 'prod') {
    return (
      <div className="fr-container fr-container--fluid flex flex-col items-center justify-center gap-4 p-34">
        <div className="fr-alert fr-alert--info">
          <p>Mes chasses non disponible en production</p>
        </div>
        <Button
          priority="primary"
          linkProps={{
            to: '/app/tableau-de-bord',
          }}
        >
          Aller à la page d'accueil
        </Button>
      </div>
    );
  }
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
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

  const isSmallGameOnly = dashboardData.bigGame === 0 && dashboardData.smallGame > 0;

  if (dashboardData.totalCarcasses === 0) {
    return (
      <div className="fr-container fr-container--fluid min-h-screen">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 p-2 md:p-0">
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
              <h2 className="mb-3 text-center text-4xl font-bold text-gray-800">
                Pas encore de carcasses cette saison
              </h2>
              <p className="mb-6 max-w-md text-center text-gray-600">
                Vos statistiques apparaîtront ici dès que vous aurez enregistré votre première fiche d'examen
                initial.
              </p>
              <Button
                priority="primary"
                iconId="fr-icon-add-circle-line"
                onClick={async () => {
                  const newFei = await createNewFei();
                  navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                }}
              >
                Créer une fiche
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fr-container fr-container--fluid min-h-screen max-w-4xl">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
        <div className="fr-col-12 p-2 md:p-0">
          <div className="mb-6 grid grid-cols-2 gap-3 md:gap-8">
            <TotalCarcassesCard total={dashboardData.totalCarcasses} season={dashboardData.season} />
            <CarcassBreakdownCard bigGame={dashboardData.bigGame} smallGame={dashboardData.smallGame} />
            {isSmallGameOnly ? (
              <div className="col-span-2">
                <Alert
                  severity="info"
                  title=""
                  description="Les indicateurs de tableau de bord pour le petit gibier sont en cours de développement. Vous verrez bientôt votre taux de saisie et les principales raisons de refus et de saisie."
                />
              </div>
            ) : (
              <>
                {dashboardData.hygieneScore !== null && (
                  <HygieneScoreCard score={dashboardData.hygieneScore} />
                )}
                <RefusalCausesCard causes={dashboardData.refusalCauses} />
                {dashboardData.personalSeizureRate !== null && (
                  <SeizureRateCardPersonal
                    rate={dashboardData.personalSeizureRate}
                    label="taux de saisie personnel grand gibier"
                  />
                )}
                <SeizureRateCard
                  rate={dashboardData.nationalSeizureRate}
                  label="taux de saisie national en 2024"
                />
                <div className="col-span-2">
                  <Alert
                    className="w-full bg-white"
                    severity="info"
                    title="Données personnelles"
                    description="Ces statistiques sont réservées à votre usage personnel et ne sont pas partagées avec l'administration. Elles reflètent uniquement les données enregistrées sur Zacharie."
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
