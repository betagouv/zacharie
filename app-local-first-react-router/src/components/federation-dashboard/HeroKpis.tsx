import KpiTile from './KpiTile';

interface ValorisationTotals {
  ggTotal: number;
  pgTotal: number;
  pgTotalAnimaux: number;
  ggTauxSaisie: number | null;
  pgTauxSaisie: number | null;
}

interface SanitaireTotals {
  tuberculose: number;
  pestePorcine: number;
  brucellose: number;
  tularemie: number;
}

interface FormationData {
  totalExaminateurs: number;
  nationalScoreBph: number | null;
}

interface Props {
  valorisation: ValorisationTotals | null;
  sanitaire: SanitaireTotals | null;
  formation: FormationData | null;
}

function formatTaux(taux: number | null): string {
  if (taux === null) return '—';
  return `${taux}%`;
}

export default function HeroKpis({ valorisation, formation }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiTile
        label="Grand gibier (GG)"
        value={valorisation?.ggTotal ?? '—'}
        sublabel="animaux prélevés cette saison"
        accent="blue"
      />
      <KpiTile
        label="Petit gibier (PG)"
        value={valorisation?.pgTotalAnimaux ?? '—'}
        sublabel={
          valorisation
            ? `animaux prélevés cette saison (${valorisation.pgTotal} lot${valorisation.pgTotal > 1 ? 's' : ''})`
            : 'animaux prélevés cette saison'
        }
        accent="amber"
      />
      <KpiTile
        label="Taux saisie grand gibier"
        value={formatTaux(valorisation?.ggTauxSaisie ?? null)}
        accent="blue"
      />
      <KpiTile
        label="Examinateurs actifs"
        value={formation?.totalExaminateurs ?? '—'}
        sublabel="≥ 1 fiche transmise"
        accent="green"
      />
    </div>
  );
}
