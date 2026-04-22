import { Badge } from '@codegouvfr/react-dsfr/Badge';
import Button from '@codegouvfr/react-dsfr/Button';

interface Metric {
  value: string;
  label: string;
  description?: string;
}

interface Pillar {
  title: string;
  subtitle: string;
  severity: 'info' | 'success' | 'new' | 'warning' | 'error';
  bgClass: string;
  metrics: Metric[];
}

const PILLARS: Pillar[] = [
  {
    title: 'Usage',
    subtitle: 'Satisfaction',
    severity: 'info',
    bgClass: 'bg-[var(--background-alt-blue-france)]',
    metrics: [
      { value: '9,3/10', label: 'NPS Chasseurs' },
      { value: '8,5/10', label: 'NPS Etablissements de Traitement du Gibier' },
      { value: '8,6/10', label: 'NPS Collecteurs' },
      { value: '8,5/10', label: "NPS Services Vétérinaires d'Inspection" },
    ],
  },
  {
    title: 'Usage',
    subtitle: 'Adoption',
    severity: 'info',
    bgClass: 'bg-[var(--background-alt-green-emeraude)]',
    metrics: [
      { value: '136', label: 'Chasseurs actifs', description: 'Ayant soumis ≥1 FEI (saison 25-26)' },
      { value: '72,8%', label: 'Taux de rétention', description: 'Chasseurs soumettant ≥2 FEI' },
    ],
  },
  {
    title: 'Usage',
    subtitle: 'Adoption',
    severity: 'info',
    bgClass: 'bg-[var(--background-alt-green-emeraude)]',
    metrics: [
      { value: '8 494', label: 'Carcasses grand gibier', description: 'Saison 25-26' },
      { value: '14,4%', label: 'Part de marché', description: 'Circuit long, grand gibier' },
      { value: '26 917', label: 'Carcasses petit gibier', description: 'Saison 25-26' },
      { value: '20%', label: 'Part de marché', description: 'Circuit long, petit gibier' },
    ],
  },
  {
    title: 'Impact',
    subtitle: 'Résultats sanitaires',
    severity: 'success',
    bgClass: 'bg-[var(--background-alt-green-tilleul-verveine)]',
    metrics: [
      {
        value: '3,73%',
        label: "Saisies vétérinaires dues à de mauvaises pratiques d'hygiène",
        description: 'vs 7,6% hors Zacharie',
      },
      { value: '0,4%', label: 'Anomalies non-éliminatoires déclarées par les chasseurs', description: 'Grand gibier' },
    ],
  },
  {
    title: 'Efficience',
    subtitle: 'Coût / efficacité',
    severity: 'new',
    bgClass: 'bg-[var(--background-alt-yellow-tournesol)]',
    metrics: [
      { value: '867 €', label: 'Coût par utilisateur', description: 'En baisse : 2 656 € → 1 410 € → 867 €' },
      { value: '10 €', label: 'Coût par carcasse', description: 'En baisse : 66 € → 45 € → 10 €' },
      { value: '60 800 €/an', label: 'Économies SVI', description: '5h/sem. de temps gagné pour 19 SVI' },
    ],
  },
];

export default function ImpactMatrix() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-2xl font-bold">Matrice d'impact</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className={`rounded-lg border-1 border-gray-200 p-5`}
            >
              <div className="mb-3 flex items-center gap-2">
                <Badge
                  severity={pillar.severity}
                  noIcon
                >
                  {pillar.title}
                </Badge>
              </div>
              <div className="space-y-3">
                {pillar.metrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="text-2xl leading-tight font-bold">{metric.value}</div>
                    <div className="text-sm font-medium">{metric.label}</div>
                    <div className="text-xs text-gray-600">{metric.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-xs text-gray-500">Données : saison 2025-2026</p>
      </section>
      <Button
        className="m-0"
        priority={'tertiary'}
        linkProps={{
          to: '/stats',
        }}
      >
        Retour aux statistiques
      </Button>
    </div>
  );
}
