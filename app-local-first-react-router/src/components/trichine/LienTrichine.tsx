import type { ReactNode } from 'react';
import { Link } from 'react-router';

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
