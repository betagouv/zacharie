import { useEffect, useState } from 'react';
import API from '@app/services/api';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { type DepartementRow } from '@app/components/ValorisationTable';
import HeroKpis from '@app/components/federation-dashboard/HeroKpis';
import SectionValorisation from '@app/components/federation-dashboard/SectionValorisation';
import SectionSanitaire, {
  type SanitaireRow,
  type SanitaireTotals,
} from '@app/components/federation-dashboard/SectionSanitaire';
import SectionFormation, {
  type FormationNational,
  type FormationRow,
} from '@app/components/federation-dashboard/SectionFormation';

type FederationScope = 'departemental' | 'regional' | 'national';

interface ValorisationTotals {
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  ggTotal: number;
  ggSeized: number;
  ggSviEligible: number;
  ggTauxSaisie: number | null;
  pgAgree: number;
  pgNonAgree: number;
  pgDomestique: number;
  pgTotal: number;
  pgSeized: number;
  pgSviEligible: number;
  pgTauxSaisie: number | null;
}

interface ValorisationData {
  season: string | null;
  scope: FederationScope;
  scopeDepts: string[];
  departements: DepartementRow[];
  totals: ValorisationTotals;
}

interface SanitaireData {
  season: string | null;
  scope: FederationScope;
  scopeDepts: string[];
  departements: SanitaireRow[];
  totals: SanitaireTotals;
}

interface FormationData {
  season: string | null;
  scope: FederationScope;
  scopeDepts: string[];
  departements: FormationRow[];
  national: FormationNational;
  totals: { examinateursActifs: number };
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const SCOPE_LABEL: Record<FederationScope, string> = {
  departemental: 'Tableau de bord départemental',
  regional: 'Tableau de bord régional',
  national: 'Tableau de bord national',
};

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

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="fr-h4 mb-3">{title}</h2>
      <div className="h-40 animate-pulse rounded bg-gray-100" />
    </section>
  );
}

function SectionError({ title, message }: { title: string; message: string }) {
  return (
    <section>
      <h2 className="fr-h4 mb-3">{title}</h2>
      <Alert
        severity="error"
        title="Erreur"
        description={message}
      />
    </section>
  );
}

export default function FederationTableauDeBord() {
  const valo = useEndpoint<ValorisationData>('/stats/federation/valorisation');
  const sani = useEndpoint<SanitaireData>('/stats/federation/sanitaire');
  const form = useEndpoint<FormationData>('/stats/federation/formation');

  // Header — l'attente du valo suffit, c'est le seul à porter scope/season fiables.
  const headerData = valo.data ?? sani.data ?? form.data;

  return (
    <div className="fr-container fr-container--fluid min-h-screen pb-12">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
        <div className="fr-col-12 fr-col-lg-11">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 px-2 md:px-0">
            <h1 className="fr-h3 mb-0">{headerData ? SCOPE_LABEL[headerData.scope] : 'Tableau de bord'}</h1>
            {headerData?.season && (
              <span className="fr-badge fr-badge--blue-france">Saison {headerData.season}</span>
            )}
          </header>

          <Alert
            small
            severity="info"
            title=""
            description="Statistiques anonymes agrégées par département de prélèvement. Les fiches individuelles ne sont pas accessibles."
          />

          <div className="mt-6 space-y-8">
            <section className="px-2 md:px-0">
              <HeroKpis
                valorisation={valo.data?.totals ?? null}
                sanitaire={sani.data?.totals ?? null}
                formation={
                  form.data
                    ? {
                        totalExaminateurs: form.data.totals.examinateursActifs,
                        nationalScoreBph: form.data.national.scoreBph,
                      }
                    : null
                }
              />
            </section>

            <section className="px-2 md:px-0">
              <h2 className="fr-h4 mb-3">Modalités de valorisation</h2>
              {valo.loading ? (
                <div className="h-40 animate-pulse rounded bg-gray-100" />
              ) : valo.error || !valo.data ? (
                <Alert
                  severity="error"
                  title="Erreur"
                  description={valo.error || 'Aucune donnée disponible'}
                />
              ) : (
                <SectionValorisation
                  scope={valo.data.scope}
                  departements={valo.data.departements}
                  totals={valo.data.totals}
                />
              )}
            </section>

            <section className="px-2 md:px-0">
              <h2 className="fr-h4 mb-3">Suivi sanitaire de la faune sauvage</h2>
              {sani.loading ? (
                <SectionSkeleton title="" />
              ) : sani.error || !sani.data ? (
                <SectionError
                  title=""
                  message={sani.error || 'Aucune donnée disponible'}
                />
              ) : (
                <SectionSanitaire
                  scope={sani.data.scope}
                  departements={sani.data.departements}
                  totals={sani.data.totals}
                />
              )}
            </section>

            <section className="px-2 md:px-0">
              <h2 className="fr-h4 mb-3">Accompagnement à la formation</h2>
              {form.loading ? (
                <SectionSkeleton title="" />
              ) : form.error || !form.data ? (
                <SectionError
                  title=""
                  message={form.error || 'Aucune donnée disponible'}
                />
              ) : (
                <SectionFormation
                  scope={form.data.scope}
                  departements={form.data.departements}
                  national={form.data.national}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
