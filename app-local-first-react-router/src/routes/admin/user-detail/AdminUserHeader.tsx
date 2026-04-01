import { Link } from 'react-router';
import type { User } from '@prisma/client';

type AdminUserHeaderProps = {
  user: User;
};

export default function AdminUserHeader({ user }: AdminUserHeaderProps) {
  const displayName =
    user.prenom || user.nom_de_famille
      ? `${user.nom_de_famille ?? ''} ${user.prenom ?? ''}`.trim()
      : null;

  return (
    <header className="mb-3 border-b border-gray-200 pb-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#666]">
        <Link
          to="/app/tableau-de-bord/admin/users"
          className="fr-link fr-link--icon-left fr-icon-arrow-left-line !inline-flex no-underline"
        >
          Utilisateurs
        </Link>
        <span className="text-gray-300" aria-hidden>
          /
        </span>
        <span className="max-w-[min(100%,28rem)] truncate font-medium text-[#161616]">
          {displayName || user.email}
        </span>
      </div>

      <div className="min-w-0">
        <h1 className="fr-mb-0 text-[1.15rem] font-semibold leading-snug text-[#161616]">
          {displayName || user.email}
        </h1>
        {displayName ? (
          <p className="fr-mb-0 mt-0.5 max-w-xl text-sm text-[#666]">{user.email}</p>
        ) : null}
      </div>
    </header>
  );
}
