import { useEffect, useMemo, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import KpiCard from '@app/components/dashboard/KpiCard';
import VolumeCard from '@app/components/dashboard/VolumeCard';
import EspeceBreakdownCard from '@app/components/dashboard/EspeceBreakdownCard';
import SectionHeader from '@app/components/dashboard/SectionHeader';
import BreakdownListCard from '@app/components/dashboard/BreakdownListCard';
import DurationCard from '@app/components/dashboard/DurationCard';
import TrendChartCard from '@app/components/dashboard/TrendChartCard';
import { trackEvent } from '@app/services/matomo';

interface TopUserItem {
  userId: string;
  nom: string;
  count: number;
}
interface TopEntityItem {
  entityId: string;
  nom: string;
  count: number;
}

interface EtgStats {
  toAccept: number;
  ongoing: number;
  volume7d: number;
  volume30d: number;
  carcassesByEspece: { gros: number; petit: number };
  transmisSvi30d: number;
  delaiAcceptationMsAvg: number | null;
  carcasses30d: number;
  topEspeces: { espece: string; count: number }[];
  carcassesRefusees30d: number;
  carcassesManquantes30d: number;
  carcassesAnomalies30d: number;
  premierDetenteursActifs30d: number;
  topPremierDetenteurs: TopUserItem[];
  topEntitesChasse: TopEntityItem[];
  delaiDecisionMsMedian: number | null;
  tauxAcceptation30d: number;
  trendMensuel: { mois: string; count: number }[];
}

interface EtgStatsResponse {
  ok: boolean;
  data?: EtgStats;
  error?: string;
}

const MONTH_LABELS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function formatMonthLabel(mois: string): string {
  const [yearStr, monthStr] = mois.split('-');
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return mois;
  return `${MONTH_LABELS[monthIndex]} ${yearStr.slice(2)}`;
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

  const trendData = useMemo(
    () =>
      stats
        ? stats.trendMensuel.map((m) => ({ label: formatMonthLabel(m.mois), value: m.count }))
        : [],
    [stats]
  );

  if (loading) return <Chargement />;

  if (error || !stats) {
    return (
      <div className="fr-container fr-container--fluid min-h-screen">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Alert severity="error" title="Erreur" description={error || 'Aucune donnée disponible'} />
          </div>
        </div>
      </div>
    );
  }

  const totalActive = stats.toAccept + stats.ongoing;
  const refusPct =
    stats.carcasses30d > 0 ? Math.round((stats.carcassesRefusees30d / stats.carcasses30d) * 100) : 0;
  const manquantesPct =
    stats.carcasses30d > 0 ? Math.round((stats.carcassesManquantes30d / stats.carcasses30d) * 100) : 0;

  const hasNoActivity = totalActive === 0 && stats.volume30d === 0;

  return (
    <div className="fr-container fr-container--fluid">
      <title>Tableau de bord | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center py-4">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 text-action-high-blue-france-light mb-6">Tableau de bord</h1>

          {hasNoActivity ? (
            <div className="rounded-3xl bg-white p-8 text-center">
              <h2 className="fr-h4 mb-3 font-bold text-gray-800">Pas encore d'activité</h2>
              <p className="fr-text--regular max-w-md">
                Vos indicateurs apparaîtront ici dès que des fiches seront en circulation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <section>
                <SectionHeader title="Fiches" subtitle="Suivi des fiches en circulation" />
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
                    <KpiCard
                      value={stats.transmisSvi30d}
                      label="Fiches transmises au SVI"
                      sublabel="sur les 30 derniers jours"
                      accent="purple"
                      iconId="fr-icon-send-plane-line"
                    />
                    <DurationCard
                      title="Délai moyen d'acceptation"
                      sublabel="entre approbation examinateur et prise en charge (30j)"
                      accent="yellow"
                      iconId="fr-icon-timer-line"
                      durationMs={stats.delaiAcceptationMsAvg}
                    />
                  </div>
                  <VolumeCard
                    title="Fiches prises en charge"
                    volume7d={stats.volume7d}
                    volume30d={stats.volume30d}
                    accent="purple"
                    iconId="fr-icon-bar-chart-box-line"
                  />
                </div>
              </section>

              <section>
                <SectionHeader title="Carcasses" subtitle="Répartition et qualité sur 30 jours" />
                <div className="flex flex-col gap-4 md:gap-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <KpiCard
                      value={stats.carcasses30d}
                      label="Carcasses prises en charge"
                      sublabel="sur les 30 derniers jours"
                      accent="green"
                      iconId="fr-icon-archive-line"
                    />
                    <EspeceBreakdownCard
                      gros={stats.carcassesByEspece.gros}
                      petit={stats.carcassesByEspece.petit}
                      accent="green"
                      iconId="fr-icon-pie-chart-2-line"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <BreakdownListCard
                      title="Top 5 espèces (30j)"
                      accent="green"
                      iconId="fr-icon-leaf-line"
                      items={stats.topEspeces.map((e) => ({ label: e.espece, value: e.count }))}
                    />
                    <KpiCard
                      value={stats.carcassesAnomalies30d}
                      label="Carcasses avec anomalies"
                      sublabel="signalées à l'examen initial (30j)"
                      accent="yellow"
                      iconId="fr-icon-alert-line"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <KpiCard
                      value={stats.carcassesRefusees30d}
                      label="Carcasses refusées"
                      sublabel={`${refusPct}% des carcasses (30j)`}
                      accent="orange"
                      iconId="fr-icon-close-circle-line"
                    />
                    <KpiCard
                      value={stats.carcassesManquantes30d}
                      label="Carcasses manquantes"
                      sublabel={`${manquantesPct}% des carcasses (30j)`}
                      accent="pink"
                      iconId="fr-icon-question-line"
                    />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader
                  title="Premier détenteur"
                  subtitle="Chasseurs et associations qui vous transmettent des fiches"
                />
                <div className="flex flex-col gap-4 md:gap-6">
                  <KpiCard
                    value={stats.premierDetenteursActifs30d}
                    label="Premier détenteurs actifs"
                    sublabel="ayant transmis au moins une fiche (30j)"
                    accent="blue"
                    iconId="fr-icon-user-line"
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <BreakdownListCard
                      title="Top 5 chasseurs"
                      accent="blue"
                      iconId="fr-icon-medal-line"
                      items={stats.topPremierDetenteurs.map((u) => ({ label: u.nom, value: u.count }))}
                      emptyLabel="Aucun chasseur sur les 30 derniers jours"
                    />
                    <BreakdownListCard
                      title="Top 5 entités de chasse"
                      accent="purple"
                      iconId="fr-icon-team-line"
                      items={stats.topEntitesChasse.map((e) => ({ label: e.nom, value: e.count }))}
                      emptyLabel="Aucune entité sur les 30 derniers jours"
                    />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Activité" subtitle="Performance et évolution dans le temps" />
                <div className="flex flex-col gap-4 md:gap-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <DurationCard
                      title="Délai médian de décision"
                      sublabel="entre prise en charge et décision (30j)"
                      accent="yellow"
                      iconId="fr-icon-time-line"
                      durationMs={stats.delaiDecisionMsMedian}
                    />
                    <KpiCard
                      value={stats.tauxAcceptation30d}
                      label="Taux d'acceptation"
                      sublabel="carcasses acceptées sur traitées (30j)"
                      accent="green"
                      iconId="fr-icon-checkbox-circle-line"
                    />
                  </div>
                  <TrendChartCard
                    title="Évolution mensuelle des prises en charge"
                    accent="blue"
                    iconId="fr-icon-line-chart-line"
                    data={trendData}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
