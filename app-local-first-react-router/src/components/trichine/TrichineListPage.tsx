import type { ReactNode } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';

/**
 * Gabarit commun aux listes trichine (échantillons, pools, FTP).
 * En-tête explicite + chiffres clés + barre de filtres, puis la table.
 */
export default function TrichineListPage({
  titre,
  description,
  stats,
  actions,
  toolbar,
  children,
}: {
  titre: string;
  description?: string;
  stats?: Array<{ value: number; label: string }>;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-4">
      <title>{`${titre} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <header className="fr-mb-3w flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="fr-h3 fr-mb-1w">{titre}</h1>
          {!!description && <p className="fr-text--sm m-0 text-gray-600">{description}</p>}
        </div>
        {!!actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>

      {!!stats?.length && (
        <div className="fr-mb-3w grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded border border-gray-200 bg-white p-4"
            >
              <p className="fr-h4 fr-mb-0">{stat.value}</p>
              <p className="fr-text--sm fr-mb-0 text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {toolbar}
      {children}
    </div>
  );
}

/**
 * Filtres d'une liste : la recherche libre couvre les colonnes d'identifiants (références,
 * numéros, noms), les autres colonnes affichées ont chacune leur contrôle dédié (`children`).
 */
export function TrichineListToolbar({
  query,
  onQueryChange,
  searchHint,
  children,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchHint: string;
  children?: ReactNode;
}) {
  return (
    <div className="fr-mb-2w flex flex-wrap items-end gap-4">
      <Input
        label="Rechercher"
        hintText={searchHint}
        className="fr-mb-0 min-w-64 flex-1"
        nativeInputProps={{
          type: 'search',
          value: query,
          onChange: (event) => onQueryChange(event.target.value),
          placeholder: 'Référence…',
        }}
      />
      {children}
    </div>
  );
}

/** Filtre d'une colonne à valeurs énumérables : une valeur, ou toutes. */
export function FiltreSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select
      label={label}
      className="fr-mb-0 min-w-48"
      nativeSelectProps={{ value, onChange: (event) => onChange(event.target.value) }}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** Filtre d'une colonne date : bornes inclusives, chacune facultative. */
export function FiltrePeriode({
  label,
  du,
  au,
  onDuChange,
  onAuChange,
}: {
  label: string;
  du: string;
  au: string;
  onDuChange: (value: string) => void;
  onAuChange: (value: string) => void;
}) {
  return (
    <div className="fr-mb-0">
      <span className="fr-label fr-mb-1v block">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="fr-input"
          aria-label={`${label} : à partir du`}
          value={du}
          onChange={(event) => onDuChange(event.target.value)}
        />
        <span className="fr-text--sm fr-mb-0">au</span>
        <input
          type="date"
          className="fr-input"
          aria-label={`${label} : jusqu'au`}
          value={au}
          onChange={(event) => onAuChange(event.target.value)}
        />
      </div>
    </div>
  );
}
