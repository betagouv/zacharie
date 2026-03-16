import { Link, Outlet, useLocation } from 'react-router';

const adminLinks = [
  { to: '/app/tableau-de-bord/admin/dashboard', label: 'Tableau de bord', icon: 'fr-icon-dashboard-3-line' },
  { to: '/app/tableau-de-bord/admin/users', label: 'Utilisateurs', icon: 'fr-icon-user-line' },
  { to: '/app/tableau-de-bord/admin/entities', label: 'Entités', icon: 'fr-icon-building-line' },
  { to: '/app/tableau-de-bord/admin/import-ccg', label: 'Import CCG', icon: 'fr-icon-upload-line' },
  { to: '/app/tableau-de-bord/admin/api-keys', label: 'Clés API', icon: 'fr-icon-lock-line' },
  {
    to: '/app/tableau-de-bord/admin/carcasses-intermediaires',
    label: 'Carcasses Inter.',
    icon: 'fr-icon-file-text-line',
  },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex">
      <nav className="sticky top-0 self-start min-h-screen max-h-screen bg-white border-r border-gray-200 shrink-0 py-2 overflow-y-auto">
        <ul className="list-none m-0 mt-2 px-2">
          {adminLinks.map((link) => {
            const isActive = location.pathname.startsWith(link.to);
            return (
              <li key={link.to}>
                <Link
                  style={{ backgroundImage: 'none' }}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm no-underline border-l-2 hover:bg-gray-100 ${isActive
                    ? 'bg-open-blue-975 text-action-high-blue-france font-medium border-action-high-blue-france'
                    : 'text-title-grey  border-transparent'
                    }`}
                >
                  <span className={`${link.icon} fr-icon--sm shrink-0 mr-1`} aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <a
              href="https://metabase.zacharie.beta.gouv.fr/question/27-fiches-creees"
              target="_blank"
              style={{ backgroundImage: 'none' }}
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-title-grey no-underline hover:bg-open-blue-975 border-l-2 border-transparent hover:bg-gray-100 rounded-md"
            >
              <span className="fr-icon-line-chart-line fr-icon--sm shrink-0 mr-1" aria-hidden="true" />
              Fiches
            </a>
          </li>
        </ul>
      </nav>
      <main className="fr-container min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
