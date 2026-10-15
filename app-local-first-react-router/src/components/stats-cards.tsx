import type { ReactNode } from 'react';
import { Tooltip as DsfrTooltip } from '@codegouvfr/react-dsfr/Tooltip';
import { BarChart } from 'react-dsfr-chart/BarChart';
import 'react-dsfr-chart/css';
import type { MotifDatum } from '@app/utils/bph-motifs';
import { getMotifShortLabel } from '@app/utils/lesions';

// Borne minimale de l'axe des valeurs. Les décomptes sont entiers : sous 6,
// l'axe se graduerait en demis (0 / 0,5 / 1).
export const MIN_COUNT_AXIS = 6;

// Palette `neutral` + `highlightIndex` : les motifs d'hygiène prennent la
// couleur d'accent, les autres le gris neutre.
const HYGIENE_COLOR = 'var(--rdc-default)';
const NON_HYGIENE_COLOR = 'var(--rdc-neutral)';

export function StatsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5">
      <h2 className="fr-h5 mt-0 mb-4 border-b border-gray-200 pb-3 text-gray-900">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="fr-h6 mb-1">{title}</h3>
      {legend && (
        <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center">
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: HYGIENE_COLOR }}
            />
            Motif lié à un défaut d'hygiène évitable
          </span>
          <span className="inline-flex items-center">
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: NON_HYGIENE_COLOR }}
            />
            Autre motif
          </span>
        </p>
      )}
      {children}
    </div>
  );
}

export function MotifBarChart({
  data,
  emptyLabel,
  ariaLabel = 'Motifs de saisie',
}: {
  data: MotifDatum[];
  emptyLabel: string;
  ariaLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">{emptyLabel}</p>;
  }
  return (
    <BarChart
      x={data.map((d) => getMotifShortLabel(d.motif))}
      y={[data.map((d) => d.count)]}
      name={['Nombre de carcasses']}
      horizontal
      selectedPalette="neutral"
      highlightIndex={data.flatMap((d, index) => (d.hygiene ? [index] : []))}
      xMax={Math.max(...data.map((d) => d.count), MIN_COUNT_AXIS)}
      height={Math.max(220, data.length * 28)}
      unitTooltip="carcasses"
      ariaLabel={ariaLabel}
    />
  );
}

export function StatCard({
  label,
  value,
  sub,
  info,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  info?: string;
}) {
  return (
    <div className="flex min-w-48 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <span className="flex items-center gap-1 text-sm text-gray-600">
        {label}
        {info && (
          <DsfrTooltip
            kind="hover"
            title={info}
          />
        )}
      </span>
      {sub && <span className="mt-1 text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
