import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Gabarit commun aux pages de détail trichine (échantillon, pool, FTP).
 * Identité + actions en haut, chaîne de traçabilité juste dessous, puis deux colonnes :
 * le contenu à gauche, ce qui situe l'objet dans le temps à droite.
 *
 * `banniere` sert aux décisions qu'on ne peut pas laisser passer : elle colle en haut de l'écran
 * pendant tout le défilement, là où les actions de l'en-tête disparaissent dès qu'on lit la page.
 */
export default function TrichineDetailPage({
  surtitre,
  titre,
  retour,
  banniere,
  badges,
  actions,
  chaine,
  aside,
  children,
}: {
  surtitre: string;
  titre: string;
  retour: { to: string; label: string };
  /** Action à ne pas manquer : reste visible au défilement, au-dessus du reste de la page. */
  banniere?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  chaine?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-4">
      <title>{`${titre} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {!!banniere && <div className="fr-mb-2w sticky top-0 z-30">{banniere}</div>}
      <Link
        to={retour.to}
        className="fr-link fr-icon-arrow-left-line fr-link--icon-left fr-mb-2w inline-block"
      >
        {retour.label}
      </Link>

      <header className="fr-mb-3w flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="fr-text--sm m-0 text-gray-600">{surtitre}</p>
          <h1 className="fr-h3 fr-mb-1w break-all">{titre}</h1>
          {!!badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
        </div>
        {!!actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {chaine}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">{children}</div>
        {!!aside && <div className="space-y-6">{aside}</div>}
      </div>
    </div>
  );
}

/** Bloc de contenu : c'est l'unité de découpage des pages de détail. */
export function TrichineCard({
  titre,
  hint,
  actions,
  children,
  className = '',
}: {
  titre: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border border-gray-200 bg-white p-6 ${className}`}>
      <div className="fr-mb-2w flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="fr-h6 fr-mb-0">{titre}</h2>
          {!!hint && <p className="fr-text--sm fr-mb-0 text-gray-600">{hint}</p>}
        </div>
        {!!actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Liste de couples libellé / valeur.
 * `grille` (défaut) pour la colonne principale, large : deux colonnes, libellé au-dessus.
 * `lignes` pour la colonne latérale, étroite : une ligne par donnée, valeur alignée à droite —
 * deux colonnes y couperaient les valeurs longues (une adresse email) en plein milieu d'un mot.
 */
export function TrichineFields({
  fields,
  disposition = 'grille',
}: {
  fields: Array<{ label: string; value: ReactNode } | null | false>;
  disposition?: 'grille' | 'lignes';
}) {
  const visibles = fields.filter(Boolean) as Array<{ label: string; value: ReactNode }>;

  if (disposition === 'lignes') {
    return (
      <dl className="m-0 flex flex-col gap-2">
        {visibles.map((field) => (
          <div
            key={field.label}
            className="flex flex-wrap items-baseline justify-between gap-x-4"
          >
            <dt className="fr-text--xs m-0 shrink-0 text-gray-600">{field.label}</dt>
            <dd className="fr-text--sm m-0 min-w-0 font-medium break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {visibles.map((field) => (
        <div key={field.label}>
          <dt className="fr-text--xs m-0 text-gray-600">{field.label}</dt>
          <dd className="fr-text--sm m-0 font-medium">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Qui contacter au sujet de l'objet affiché. L'email et le téléphone sont des liens :
 * un laboratoire qui a une question sur un colis appelle ou écrit depuis la page.
 */
export function TrichineContact({
  nom,
  organisation,
  email,
  telephone,
}: {
  nom?: string | null;
  organisation?: string | null;
  email?: string | null;
  telephone?: string | null;
}) {
  return (
    <div className="space-y-1">
      {!!nom && <p className="fr-text--sm fr-mb-0 font-medium">{nom}</p>}
      {!!organisation && <p className="fr-text--sm fr-mb-0 text-gray-600">{organisation}</p>}
      {!!email && (
        <p className="fr-mb-0">
          <a
            href={`mailto:${email}`}
            className="fr-link fr-text--sm fr-icon-mail-line fr-link--icon-left break-all"
          >
            {email}
          </a>
        </p>
      )}
      {!!telephone && (
        <p className="fr-mb-0">
          <a
            href={`tel:${telephone}`}
            className="fr-link fr-text--sm fr-icon-phone-line fr-link--icon-left"
          >
            {telephone}
          </a>
        </p>
      )}
    </div>
  );
}

/** Filet de séparation entre deux blocs d'une même carte. */
export function TrichineSeparateur() {
  return <div className="fr-my-2w border-t border-gray-100" />;
}
