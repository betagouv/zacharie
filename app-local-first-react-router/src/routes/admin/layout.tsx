import RootDisplay from '@app/components/RootDisplay';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { UserRoles } from '@prisma/client';
import { useEffect, useState } from 'react';
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
  {
    to: '/app/admin/lesions',
    label: 'Motifs de saisies',
    icon: 'fr-icon-error-warning-line',
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const user = useMostFreshUser('RouterAdmin');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  if (!user?.isZacharieAdmin) {
    return <Navigate to="/app/connexion" />;
  }
  let mainLink = '/app/tableau-de-bord';
  if (user.roles.includes(UserRoles.CHASSEUR)) {
    mainLink = '/app/chasseur';
  }
  if (user.roles.includes(UserRoles.SVI)) {
    mainLink = '/app/svi';
  }
  if (user.roles.includes(UserRoles.ETG)) {
    mainLink = '/app/etg';
  }
  if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
    mainLink = '/app/collecteur';
  }

  return (
    <RootDisplay
      id="admin-layout"
      mainLink={mainLink}
    >
      <div className="relative flex">
        {/* Backdrop mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <nav
          className={`fixed top-0 z-[800] max-h-screen min-h-screen shrink-0 overflow-y-auto border-r border-gray-200 bg-white py-2 transition-transform duration-200 md:sticky md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <div className="flex justify-end px-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-close-line"
              aria-label="Fermer le menu"
            />
          </div>
          <ul className="m-0 list-none px-2">
            {adminLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.to);
              return (
                <li key={link.to}>
                  <Link
                    style={{ backgroundImage: 'none' }}
                    to={link.to}
                    className={`flex items-center gap-2 border-l-2 px-3 py-1.5 text-sm no-underline hover:bg-gray-100 ${isActive
                        ? 'bg-open-blue-975 text-action-high-blue-france border-action-high-blue-france font-medium'
                        : 'text-title-grey border-transparent'
                      }`}
                  >
                    <span
                      className={`${link.icon} fr-icon--sm mr-1 shrink-0`}
                      aria-hidden="true"
                    />
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
                <span
                  className="fr-icon-line-chart-line fr-icon--sm mr-1 shrink-0"
                  aria-hidden="true"
                />
                Fiches
              </a>
            </li>
          </ul>
        </nav>
        <main className="fr-container min-w-0 flex-1">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm ri-menu-line mt-2"
              aria-label="Ouvrir le menu"
            />
          )}
          <Outlet />
        </main>
      </div>
    </RootDisplay>
  );
}
