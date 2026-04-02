import RootDisplay from '@app/components/RootDisplay';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { Link, Navigate, Outlet, useLocation } from 'react-router';

const adminLinks = [
  { to: '/app/admin/dashboard', label: 'Tableau de bord', icon: 'fr-icon-dashboard-3-line' },
  { to: '/app/admin/users', label: 'Utilisateurs', icon: 'fr-icon-user-line' },
  { to: '/app/admin/entities', label: 'Entités', icon: 'fr-icon-building-line' },
  { to: '/app/admin/import-ccg', label: 'Import CCG', icon: 'fr-icon-upload-line' },
  { to: '/app/admin/api-keys', label: 'Clés API', icon: 'fr-icon-lock-line' },
  {
    to: '/app/admin/carcasses',
    label: 'Carcasses',
    icon: 'fr-icon-file-text-line',
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const user = useMostFreshUser('RouterAdmin');
  const generalNavigation = useLoggedInNavigationMenu();
  if (!user?.isZacharieAdmin) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <RootDisplay id="admin-layout" navigation={generalNavigation}>
      <div className="flex">
        <nav className="sticky top-0 max-h-screen min-h-screen shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white py-2">
          <ul className="m-0 mt-2 list-none px-2">
            {adminLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.to);
              return (
                <li key={link.to}>
                  <Link
                    style={{ backgroundImage: 'none' }}
                    to={link.to}
                    className={`flex items-center gap-2 border-l-2 px-3 py-1.5 text-sm no-underline hover:bg-gray-100 ${
                      isActive
                        ? 'bg-open-blue-975 text-action-high-blue-france border-action-high-blue-france font-medium'
                        : 'text-title-grey border-transparent'
                    }`}
                  >
                    <span className={`${link.icon} fr-icon--sm mr-1 shrink-0`} aria-hidden="true" />
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
                className="text-title-grey hover:bg-open-blue-975 flex items-center gap-2 rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm no-underline hover:bg-gray-100"
              >
                <span className="fr-icon-line-chart-line fr-icon--sm mr-1 shrink-0" aria-hidden="true" />
                Fiches
              </a>
            </li>
          </ul>
        </nav>
        <main className="fr-container min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </RootDisplay>
  );
}
