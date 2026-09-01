import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';

/**
 * Navigation latérale de l'espace trichine (même mécanique que l'espace admin) : la section
 * a ses quatre écrans propres, qui n'ont pas leur place dans la navigation principale du rôle.
 * Repliable en rail d'icônes sur desktop, en tiroir sur mobile.
 */
export default function TrichineLayout() {
  const location = useLocation();
  const basePath = useTrichineBasePath();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [navCollapsed, setNavCollapsed] = useState(
    () => window.localStorage.getItem('trichine-nav-collapsed') === 'true'
  );

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem('trichine-nav-collapsed', String(navCollapsed));
  }, [navCollapsed]);

  const links = [
    { to: basePath, label: 'Suivi', icon: 'fr-icon-dashboard-3-line', exact: true },
    { to: `${basePath}/echantillons`, label: 'Échantillons', icon: 'fr-icon-test-tube-line' },
    { to: `${basePath}/pools`, label: 'Pools', icon: 'fr-icon-microscope-line' },
    { to: `${basePath}/ftp`, label: 'Transmissions', icon: 'fr-icon-send-plane-line' },
  ];

  return (
    <div className="relative flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <nav
        aria-label="Navigation trichine"
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
      <main className="fr-container max-w-none! min-w-0 flex-1">
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
  );
}
