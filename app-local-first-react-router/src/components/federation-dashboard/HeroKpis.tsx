import KpiTile from './KpiTile';

interface ValorisationTotals {
  ggTotal: number;
  pgTotal: number;
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

function formatScore(score: number | null): string {
  if (score === null) return '—';
  return `${score}/100`;
}

export default function HeroKpis({ valorisation, sanitaire, formation }: Props) {
  const totalSanitaire = sanitaire
    ? sanitaire.tuberculose + sanitaire.pestePorcine + sanitaire.brucellose + sanitaire.tularemie
    : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiTile
        label="Grand gibier"
        value={valorisation?.ggTotal ?? '—'}
        sublabel="prélevés cette saison"
        accent="blue"
      />
      <KpiTile
        label="Petit gibier"
        value={valorisation?.pgTotal ?? '—'}
        sublabel="prélevés cette saison"
        accent="amber"
      />
      <KpiTile
        label="Taux saisie GG"
        value={formatTaux(valorisation?.ggTauxSaisie ?? null)}
        sublabel="grand gibier"
        accent="blue"
      />
      <KpiTile
        label="Examinateurs actifs"
        value={formation?.totalExaminateurs ?? '—'}
        sublabel="≥ 1 FEI transmise"
        accent="green"
      />
      <KpiTile
        label="Anomalies sanitaires"
        value={totalSanitaire ?? '—'}
        sublabel="4 maladies réglementées"
        accent="red"
      />
      <KpiTile
        label="Score BPH moyen"
        value={formatScore(formation?.nationalScoreBph ?? null)}
        sublabel="bonnes pratiques d'hygiène"
        accent="purple"
      />
    </div>
  );
}
