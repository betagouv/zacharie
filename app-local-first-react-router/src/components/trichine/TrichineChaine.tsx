import { Link } from 'react-router';

export type ChaineEtape = {
  /** Ce que représente l'étape : Carcasse, Échantillon, Pool, FTP, Laboratoire */
  label: string;
  /** Sa référence, ou le texte à afficher quand l'étape n'existe pas encore */
  value: string;
  to?: string;
  /** Étape correspondant à la page affichée */
  current?: boolean;
  /** Étape pas encore franchie (pas de pool, pas de FTP...) */
  absent?: boolean;
};

/**
 * Chaîne de traçabilité carcasse → échantillon → pool → FTP → laboratoire, affichée sur
 * chaque page de détail. C'est ce qui permet de circuler d'un objet à l'autre sans repasser
 * par les listes, et de comprendre d'un coup d'œil où en est une analyse.
 */
export default function TrichineChaine({ etapes }: { etapes: Array<ChaineEtape> }) {
  return (
    <nav
      aria-label="Chaîne de traçabilité"
      className="fr-mb-3w overflow-x-auto"
    >
      <ul className="m-0 flex list-none items-stretch gap-1 p-0">
        {etapes.map((etape, index) => (
          <li
            key={`${etape.label}-${etape.value}`}
            className="flex shrink-0 items-center gap-1"
          >
            {index > 0 && (
              <span
                aria-hidden
                className="px-1 text-gray-400"
              >
                ›
              </span>
            )}
            <EtapeContent etape={etape} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function EtapeContent({ etape }: { etape: ChaineEtape }) {
  const base = 'block rounded border px-3 py-2 text-left';
  const className = etape.current
    ? `${base} border-[var(--background-action-high-blue-france)] bg-[var(--background-action-high-blue-france)] text-white`
    : etape.absent
      ? `${base} border-dashed border-gray-300 text-gray-500`
      : `${base} border-gray-200 bg-white`;

  const content = (
    <>
      <span className={`fr-text--xs m-0 block ${etape.current ? 'text-white/80' : 'text-gray-500'}`}>
        {etape.label}
      </span>
      <span className="fr-text--sm m-0 block font-semibold whitespace-nowrap">{etape.value}</span>
    </>
  );

  if (etape.to && !etape.current) {
    return (
      <Link
        to={etape.to}
        className={`${className} bg-none hover:bg-gray-50`}
      >
        {content}
      </Link>
    );
  }
  return (
    <span
      className={className}
      aria-current={etape.current ? 'page' : undefined}
    >
      {content}
    </span>
  );
}
