import { Navigate, Outlet, useLocation, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { UserRoles } from '@prisma/client';
import RootDisplay from '@app/components/RootDisplay';
import Chargement from '@app/components/Chargement';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';

/**
 * Espace laboratoire (LVD et LNR, rôle LABORATOIRE — cf doc/trichine.md §6.3-6.4).
 * Le LNR voit les mêmes écrans : le backend filtre les FTP par entité destinataire.
 *
 * Navigation latérale (même mécanique que l'espace trichine émetteur et l'espace admin) :
 * l'espace a ses écrans propres, repliables en rail d'icônes, en tiroir sur mobile.
 */
const links = [
  { to: '/app/laboratoire', label: 'À traiter', icon: 'fr-icon-dashboard-3-line', exact: true },
  { to: '/app/laboratoire/ftp', label: 'Transmissions', icon: 'fr-icon-send-plane-line' },
  { to: '/app/laboratoire/pools', label: 'Pools', icon: 'fr-icon-microscope-line' },
  { to: '/app/laboratoire/echantillons', label: 'Échantillons', icon: 'fr-icon-test-tube-line' },
  { to: '/app/laboratoire/results/import', label: 'Importer', icon: 'fr-icon-upload-line' },
  { to: '/app/laboratoire/profil', label: 'Mon laboratoire', icon: 'fr-icon-building-line' },
];

export default function LaboratoireLayout() {
  const user = useMostFreshUser('LaboratoireLayout');
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [navCollapsed, setNavCollapsed] = useState(
    () => window.localStorage.getItem('laboratoire-nav-collapsed') === 'true'
  );

  useEffect(() => {
    refreshUser('LaboratoireLayout');
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem('laboratoire-nav-collapsed', String(navCollapsed));
  }, [navCollapsed]);

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.LABORATOIRE)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <RootDisplay
      hideMinistereName
      id="laboratoire-layout"
      contactLink="/app/laboratoire/contact"
      mainLink="/app/laboratoire"
    >
      <div className="relative flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <nav
          aria-label="Navigation laboratoire"
          className={`fixed top-0 z-[800] max-h-screen min-h-screen shrink-0 overflow-y-auto border-r border-gray-200 bg-white py-2 transition-transform duration-200 md:sticky md:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${navCollapsed ? 'md:w-14' : 'md:w-auto'}`}
        >
          <div className="flex justify-end px-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-close-line"
              aria-label="Fermer le menu"
            />
          </div>
          <div className={`hidden px-2 md:flex ${navCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              type="button"
              onClick={() => setNavCollapsed((collapsed) => !collapsed)}
              className={`fr-btn fr-btn--tertiary-no-outline fr-btn--sm ${
                navCollapsed ? 'fr-icon-arrow-right-s-line' : 'fr-icon-arrow-left-s-line'
              }`}
              aria-label={navCollapsed ? 'Déplier le menu' : 'Replier le menu'}
              title={navCollapsed ? 'Déplier le menu' : 'Replier le menu'}
            />
          </div>
          <ul className="m-0 list-none px-2">
            {links.map((link) => {
              const isActive = link.exact
                ? location.pathname === link.to
                : location.pathname.startsWith(link.to);
              return (
                <li key={link.to}>
                  <Link
                    style={{ backgroundImage: 'none' }}
                    to={link.to}
                    title={navCollapsed ? link.label : undefined}
                    className={`flex items-center gap-2 border-l-2 px-3 py-1.5 text-sm no-underline hover:bg-gray-100 ${
                      navCollapsed ? 'md:justify-center md:px-0' : ''
                    } ${
                      isActive
                        ? 'bg-open-blue-975 text-action-high-blue-france border-action-high-blue-france font-medium'
                        : 'text-title-grey border-transparent'
                    }`}
                  >
                    <span
                      className={`${link.icon} fr-icon--sm shrink-0 ${navCollapsed ? 'md:mr-0' : 'mr-1'}`}
                      aria-hidden="true"
                    />
                    <span className={navCollapsed ? 'md:hidden' : ''}>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france fr-container max-w-none! min-w-0 flex-1"
        >
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm ri-menu-line mt-2"
              aria-label="Ouvrir le menu"
            />
          )}
          {!_hasHydrated ? <Chargement /> : <Outlet />}
        </main>
      </div>
    </RootDisplay>
  );
}
