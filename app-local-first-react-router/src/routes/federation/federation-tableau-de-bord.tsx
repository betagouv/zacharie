import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import DepartementValorisationCard from './components/DepartementValorisationCard';
import ValorisationTable, { type DepartementRow } from './components/ValorisationTable';

interface ValorisationData {
  season: string | null;
  scope: 'departemental' | 'regional' | 'national';
  scopeDepts: string[];
  departements: DepartementRow[];
}

interface ValorisationResponse {
  ok: boolean;
  data?: ValorisationData;
  error?: string;
}

const SCOPE_LABEL: Record<ValorisationData['scope'], string> = {
  departemental: 'Tableau de bord départemental',
  regional: 'Tableau de bord régional',
  national: 'Tableau de bord national',
};

export default function FederationTableauDeBord() {
  const [data, setData] = useState<ValorisationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = (await API.get({
          path: '/stats/federation/valorisation',
        })) as ValorisationResponse;
        if (cancelled) return;
        if (response.ok && response.data) {
          setData(response.data);
        } else {
          setError(response.error || 'Erreur lors du chargement des données');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching federation dashboard data:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Chargement />;

  if (error || !data) {
    return (
      <div className="fr-container fr-container--fluid min-h-screen">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 p-4 md:p-0">
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

  const isSingleDept = data.scope === 'departemental' && data.departements.length === 1;

  return (
    <div className="fr-container fr-container--fluid min-h-screen">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
        <div className="fr-col-12 fr-col-lg-11">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="fr-h3 mb-0">{SCOPE_LABEL[data.scope]}</h1>
            {data.season && <span className="fr-badge fr-badge--blue-france">Saison {data.season}</span>}
          </div>
          <Alert
            small
            severity="info"
            title=""
            description="Statistiques anonymes agrégées par département de prélèvement. Les fiches individuelles ne sont pas accessibles."
          />
          <div className="mt-4">
            {data.departements.length === 0 ? (
              <Alert
                severity="info"
                title="Aucune donnée pour cette saison"
                description="Aucune carcasse n'a été enregistrée dans Zacharie pour le périmètre de votre fédération sur la saison en cours."
              />
            ) : isSingleDept ? (
              <DepartementValorisationCard {...data.departements[0]} />
            ) : (
              <ValorisationTable
                rows={data.departements}
                showSearch={data.scope === 'national'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
