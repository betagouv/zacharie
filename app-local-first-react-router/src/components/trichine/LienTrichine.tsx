import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Lien d'une cellule de table vers l'entité qu'elle désigne (pool, carcasse, FTP).
 * La ligne entière est déjà cliquable : le lien stoppe la propagation pour que le clic
 * ne déclenche pas les deux navigations.
 *
 * Le soulignement vient du DSFR, qui le dessine sur tout `[href]` — ne pas ajouter la
 * classe Tailwind `underline` par-dessus, les deux traits se superposeraient.
 */
export default function LienTrichine({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="fr-link fr-link--sm"
      onClick={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
