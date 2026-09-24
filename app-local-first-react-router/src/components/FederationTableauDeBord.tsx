import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import API from '@app/services/api';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import Chargement from '@app/components/Chargement';
import KpiTile from '@app/components/federation-dashboard/KpiTile';
import DepartementsTable, {
  type DepartementRow,
  type FormationRow,
} from '@app/components/federation-dashboard/DepartementsTable';
import SectionValorisation from '@app/components/federation-dashboard/SectionValorisation';
import SectionSuiviSanitaire from '@app/components/federation-dashboard/SectionSuiviSanitaire';

import type { FederationScope } from '@api/src/utils/federation-stats';

interface ValorisationTotals {
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  ggTotal: number;
  ggSeized: number;
  ggSviEligible: number;
  ggTauxSaisie: number | null;
  pgAgree: number;
  pgAgreeAnimaux: number;
  pgNonAgree: number;
  pgNonAgreeAnimaux: number;
  pgDomestique: number;
  pgDomestiqueAnimaux: number;
  pgTotal: number;
  pgTotalAnimaux: number;
  pgSeized: number;
  pgSviEligible: number;
  pgTauxSaisie: number | null;
  nationalGgTauxSaisie25_26: number;
}

interface SeasonRange {
  season: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
}

interface ValorisationData extends SeasonRange {
  scope: FederationScope;
  scopeLabel: string | null;
  scopeDepts: string[];
  departements: DepartementRow[];
  totals: ValorisationTotals;
}

interface SanitaireData extends SeasonRange {
  scope: FederationScope;
  scopeDepts: string[];
  totals: {
    tuberculose: number;
    pestePorcine: number;
    brucellose: number;
    tularemie: number;
  };
  anomalies: {
    total: number;
    breakdown: Array<{ motif: string; count: number }>;
  };
  sviMotifs: Array<{ motif: string; count: number }>;
}

interface FormationData extends SeasonRange {
  scope: FederationScope;
  scopeDepts: string[];
  departements: FormationRow[];
  totals: { examinateursActifs: number };
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function useEndpoint<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = (await API.get({ path })) as ApiResponse<T>;
        if (cancelled) return;
        if (response.ok && response.data) {
          setData(response.data);
        } else {
          setError(response.error || 'Erreur lors du chargement des données');
        }
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching ${path}:`, err);
        setError('Erreur lors du chargement des données');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}

/**
 * Période réellement prise en compte par les statistiques : la saison de chasse court du
 * 1er juillet au 30 juin, mais on s'arrête à aujourd'hui tant que la saison n'est pas finie.
 */
function formatSeasonRange({ seasonStart, seasonEnd }: SeasonRange): string | null {
  if (!seasonStart || !seasonEnd) return null;
  const start = dayjs(seasonStart);
  const end = dayjs(seasonEnd);
  const today = dayjs();
  const last = today.isBefore(end) ? today : end;
  return `Données du ${start.format('D MMMM YYYY')} au ${last.format('D MMMM YYYY')}`;
}

function buildTitle(valoData: ValorisationData | null): string {
  if (!valoData) return 'Tableau de bord';
  if (valoData.scope === 'national') return 'Tableau de bord national';
  if (valoData.scopeLabel) return `Tableau de bord ${valoData.scopeLabel}`;
  return valoData.scope === 'departemental' ? 'Tableau de bord départemental' : 'Tableau de bord régional';
}

export default function FederationTableauDeBord() {
  const valo = useEndpoint<ValorisationData>('/stats/federation/valorisation');
  const sani = useEndpoint<SanitaireData>('/stats/federation/sanitaire');
  const form = useEndpoint<FormationData>('/stats/federation/formation');

  const allLoading = valo.loading || sani.loading || form.loading;
  const headerData = valo.data ?? sani.data ?? form.data;
  const pageTitle = `${buildTitle(valo.data)} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`;

  if (allLoading) {
    return (
      <>
        <title>{pageTitle}</title>
        <Chargement />
      </>
    );
  }

  return (
    <div className="fr-container fr-container--fluid min-h-screen pb-12">
      <title>{pageTitle}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-8">
        <div className="fr-col-12 fr-col-lg-11">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-2 px-2 md:px-0">
            <h1 className="fr-h1 mb-0">{buildTitle(valo.data)}</h1>
            {headerData?.season && (
              <div className="flex flex-col items-start gap-1 md:items-end">
                <span className="fr-badge fr-badge--blue-france">Saison {headerData.season}</span>
                <span className="text-sm text-gray-600">{formatSeasonRange(headerData)}</span>
              </div>
            )}
          </header>

          <Alert
            small
            severity="info"
            title=""
            description="Statistiques anonymes agrégées par département de prélèvement. Les fiches individuelles ne sont pas accessibles."
          />

          <div className="mt-8 space-y-10">
            <section className="px-2 md:px-0">
              <h2 className="mb-4 text-3xl font-medium">Carcasses prélevées</h2>
              <div className="grid grid-cols-2 gap-4">
                <KpiTile
                  label="Grand gibier"
                  value={valo.data?.totals.ggTotal ?? '—'}
                  sublabel="Carcasses prélevées cette saison"
                  accent="blue"
                />
                <KpiTile
                  label="Petit gibier"
                  value={valo.data?.totals.pgTotalAnimaux ?? '—'}
                  sublabel="Carcasses prélevées cette saison"
                  accent="amber"
                />
              </div>
            </section>

            <section className="px-2 md:px-0">
              <h2 className="mb-4 text-3xl font-medium">Circuits de valorisation</h2>
              {valo.error || !valo.data ? (
                <Alert
                  severity="error"
                  title="Erreur"
                  description={valo.error || 'Aucune donnée disponible'}
                />
              ) : (
                <SectionValorisation totals={valo.data.totals} />
              )}
            </section>

            <section className="px-2 md:px-0">
              <h2 className="mb-4 text-3xl font-medium">Suivi sanitaire grand gibier</h2>
              {sani.error || !sani.data || form.error || !form.data || !valo.data ? (
                <Alert
                  severity="error"
                  title="Erreur"
                  description={sani.error || form.error || 'Aucune donnée disponible'}
                />
              ) : (
                <SectionSuiviSanitaire
                  valoScope={valo.data.scope}
                  examinateursActifs={form.data.totals.examinateursActifs}
                  anomalies={sani.data.anomalies}
                  sviMotifs={sani.data.sviMotifs}
                  ggTauxSaisie={valo.data.totals.ggTauxSaisie}
                  nationalGgTauxSaisie25_26={valo.data.totals.nationalGgTauxSaisie25_26}
                  season={valo.data.season}
                />
              )}
            </section>

            {valo.data?.scope !== 'departemental' && (
              <section className="px-2 md:px-0">
                <h2 className="mb-4 text-3xl font-medium">Détail par département</h2>
                {valo.error || form.error || !valo.data || !form.data ? (
                  <Alert
                    severity="error"
                    title="Erreur"
                    description={valo.error || form.error || 'Aucune donnée disponible'}
                  />
                ) : (
                  <DepartementsTable
                    valorisation={valo.data.departements}
                    formation={form.data.departements}
                    showSearch={valo.data.scope === 'national'}
                  />
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
