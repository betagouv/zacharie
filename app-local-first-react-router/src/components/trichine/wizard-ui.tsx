import type { ReactNode } from 'react';

/**
 * Briques d'interface de l'assistant de prélèvement.
 *
 * Volontairement hors DSFR : l'assistant est un écran de travail dense, en pleine largeur,
 * où les composants DSFR imposent des marges et des largeurs qui cassent la mise en page
 * (`.fr-text--sm` porte 1,5 rem de marge basse, les champs occupent toute la ligne...).
 * On garde en revanche les couleurs de la charte pour rester cohérent avec le reste de l'app.
 */

const BLEU = '#000091';

/* -------------------------------------------------------------------------- */
/* Boutons                                                                     */
/* -------------------------------------------------------------------------- */

type VarianteBouton = 'primaire' | 'secondaire' | 'discret';

export function Bouton({
  variante = 'primaire',
  petit = false,
  disabled,
  onClick,
  type = 'button',
  children,
}: {
  variante?: VarianteBouton;
  petit?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  const taille = petit ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5 text-sm';
  const styles: Record<VarianteBouton, string> = {
    primaire: 'text-white hover:opacity-90',
    secondaire: 'border bg-white hover:bg-gray-50',
    discret: 'text-gray-700 hover:bg-gray-100',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={
        variante === 'primaire'
          ? { backgroundColor: BLEU }
          : variante === 'secondaire'
            ? { color: BLEU, borderColor: BLEU }
            : undefined
      }
      className={`rounded font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${taille} ${styles[variante]}`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Champs                                                                      */
/* -------------------------------------------------------------------------- */

const CHAMP =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#0a76f6]';

export function Champ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-900">{label}</span>
      {!!hint && <span className="mb-1 block text-xs text-gray-600">{hint}</span>}
      {children}
    </label>
  );
}

export function ChampTexte(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={CHAMP}
    />
  );
}

export function ChampSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={CHAMP}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Pastilles et cartes                                                         */
/* -------------------------------------------------------------------------- */

const TONS = {
  neutre: 'bg-gray-100 text-gray-700',
  succes: 'bg-green-100 text-green-800',
  attention: 'bg-orange-100 text-orange-900',
  alerte: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-900',
} as const;

export function Pastille({ ton = 'neutre', children }: { ton?: keyof typeof TONS; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}

export function Carte({
  titre,
  hint,
  actions,
  children,
}: {
  titre?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          {!!titre && <h2 className="m-0 text-base font-semibold text-gray-900">{titre}</h2>}
          {!!hint && <p className="m-0 mt-1 text-sm text-gray-600">{hint}</p>}
        </div>
        {!!actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Fil des étapes                                                              */
/* -------------------------------------------------------------------------- */

export function FilEtapes({ etapes, courante }: { etapes: Array<string>; courante: number }) {
  return (
    <ul className="m-0 mb-6 flex list-none flex-wrap items-center gap-x-2 gap-y-3 p-0">
      {etapes.map((etape, index) => {
        const faite = index < courante;
        const active = index === courante;
        return (
          <li
            key={etape}
            className="flex items-center gap-2"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={`hidden h-px w-8 sm:block ${faite ? 'bg-[#000091]' : 'bg-gray-300'}`}
              />
            )}
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                faite || active ? 'text-white' : 'bg-gray-200 text-gray-600'
              }`}
              style={faite || active ? { backgroundColor: BLEU } : undefined}
              aria-hidden
            >
              {faite ? '✓' : index + 1}
            </span>
            <span
              className={`text-sm ${active ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
              aria-current={active ? 'step' : undefined}
            >
              {etape}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Choix exclusif                                                              */
/* -------------------------------------------------------------------------- */

/** Choix parmi quelques options : des boutons plutôt qu'un menu déroulant, un clic au lieu de deux. */
export function ChampChoix<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 block p-0 text-sm font-medium text-gray-900">{label}</legend>
      {!!hint && <span className="mb-1 block text-xs text-gray-600">{hint}</span>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const actif = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(option.value)}
              style={actif ? { backgroundColor: BLEU, borderColor: BLEU } : undefined}
              className={`grow rounded border px-3 py-2 text-sm font-medium transition ${
                actif ? 'text-white' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
