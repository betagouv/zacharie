import RootDisplay from '@app/components/RootDisplay';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { UserRoles } from '@prisma/client';
import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import AdminSearch from './admin-search';
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';

type AdminSessionStatus = 'loading' | 'ok' | 'proconnect-required';

type AdminNavLink = { label: string; icon: string } & ({ to: string } | { href: string });

const adminSections: Array<{ title: string; links: Array<AdminNavLink> }> = [
  {
    title: 'Pilotage',
    links: [
      { to: '/app/admin/dashboard', label: 'Tableau de bord', icon: 'fr-icon-dashboard-3-line' },
      {
        href: import.meta.env.VITE_METABASE_DASHBOARD_URL,
        label: 'Metabase',
        icon: 'fr-icon-bar-chart-box-line',
      },
    ],
  },
  {
    title: 'Données',
    links: [
      { to: '/app/admin/users', label: 'Utilisateurs', icon: 'fr-icon-user-line' },
      { to: '/app/admin/entities', label: 'Entités', icon: 'fr-icon-building-line' },
      { to: '/app/admin/feis', label: 'Fiches', icon: 'fr-icon-survey-line' },
      { to: '/app/admin/carcasses', label: 'Carcasses', icon: 'fr-icon-file-text-line' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/app/admin/bug-resolution', label: 'Résolution de bug', icon: 'fr-icon-bug-line' },
      { to: '/app/admin/journal', label: 'Journal admin', icon: 'fr-icon-time-line' },
      { to: '/app/admin/historique', label: 'Historique', icon: 'ri-history-line' },
    ],
  },
  {
    title: 'Référentiels',
    links: [
      { to: '/app/admin/import-ccg', label: 'Import CCG', icon: 'fr-icon-upload-line' },
      { to: '/app/admin/lesions', label: 'Motifs de saisies', icon: 'fr-icon-error-warning-line' },
      { to: '/app/admin/quiz', label: 'Quiz', icon: 'fr-icon-questionnaire-line' },
      ...(TRICHINE_FEATURE_ENABLED
        ? [{ to: '/app/admin/trichine', label: 'Trichine', icon: 'fr-icon-microscope-line' }]
        : []),
      { to: '/app/admin/api-keys', label: 'Clés API', icon: 'fr-icon-lock-line' },
      { to: '/app/admin/stats-ref', label: 'Références stats', icon: 'fr-icon-bar-chart-box-line' },
    ],
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const user = useMostFreshUser('RouterAdmin');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [navCollapsed, setNavCollapsed] = useState(
    () => window.localStorage.getItem('admin-nav-collapsed') === 'true'
  );
  const [sessionStatus, setSessionStatus] = useState<AdminSessionStatus>('loading');

  // Le backend exige ProConnect sur /admin : on le vérifie avant d'afficher les pages admin
  useEffect(() => {
    let cancelled = false;
    API.get({ path: 'admin/session' }).then((response) => {
      if (cancelled) return;
      setSessionStatus(response?.error === 'PROCONNECT_REQUIRED' ? 'proconnect-required' : 'ok');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem('admin-nav-collapsed', String(navCollapsed));
  }, [navCollapsed]);

  if (!user?.isZacharieAdmin) {
    return <Navigate to="/app/connexion" />;
  }
  if (sessionStatus === 'loading') {
    return <Chargement />;
  }
  if (sessionStatus === 'proconnect-required') {
    // api.ts a déjà pu pousser /app/proconnect en recevant le 403 : on ne ré-encapsule pas cette
    // URL dans un second `redirect`, sinon ProConnect renvoie l'admin sur /app/proconnect
    if (location.pathname === '/app/proconnect') return null;
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/app/proconnect?redirect=${redirect}`} />;
  }
  let mainLink = '/app/admin';
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
  if (user.roles.includes(UserRoles.LABORATOIRE)) {
    mainLink = '/app/laboratoire';
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
            className="fixed inset-0 z-20 hidden bg-black/30 max-md:block"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <nav
          className={`fixed top-0 z-[800] max-h-screen min-h-screen shrink-0 overflow-y-auto border-r border-gray-200 bg-white py-2 transition-transform duration-200 md:sticky md:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${navCollapsed ? 'md:w-14' : 'md:w-auto'}`}
        >
          <div className="hidden justify-end px-2 max-md:flex">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-close-line"
              aria-label="Fermer le menu"
            />
          </div>
          {/* Desktop : repli en rail d'icônes */}
          <div className={`hidden px-2 md:flex ${navCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              type="button"
              onClick={() => setNavCollapsed((v) => !v)}
              className={`fr-btn fr-btn--tertiary-no-outline fr-btn--sm ${
                navCollapsed ? 'fr-icon-arrow-right-s-line' : 'fr-icon-arrow-left-s-line'
              }`}
              aria-label={navCollapsed ? 'Déplier le menu' : 'Replier le menu'}
              title={navCollapsed ? 'Déplier le menu' : 'Replier le menu'}
            />
          </div>
          <ul className="m-0 list-none px-2">
            <li>
              <AdminSearch collapsed={navCollapsed} />
            </li>
            {adminSections.map((section) => (
              <li key={section.title}>
                {/* Menu replié en rail d'icônes : un trait remplace le titre de section */}
                <p
                  className={`m-0 mt-3 mb-1 px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase ${
                    navCollapsed ? 'md:hidden' : ''
                  }`}
                >
                  {section.title}
                </p>
                {navCollapsed && <hr className="mt-2 hidden border-gray-200 pb-1 md:block" />}
                <ul className="m-0 list-none p-0">
                  {section.links.map((link) => {
                    const isActive = 'to' in link && location.pathname.startsWith(link.to);
                    const className = `flex items-center gap-2 border-l-2 px-3 py-1.5 text-sm no-underline hover:bg-gray-100 ${
                      navCollapsed ? 'md:justify-center md:px-0' : ''
                    } ${
                      isActive
                        ? 'bg-open-blue-975 text-action-high-blue-france border-action-high-blue-france font-medium'
                        : 'text-title-grey border-transparent'
                    }`;
                    const content = (
                      <>
                        <span
                          className={`${link.icon} fr-icon--sm shrink-0 ${navCollapsed ? 'md:mr-0' : 'mr-1'}`}
                          aria-hidden="true"
                        />
                        <span className={navCollapsed ? 'md:hidden' : ''}>{link.label}</span>
                      </>
                    );
                    return (
                      <li key={link.label}>
                        {'to' in link ? (
                          <Link
                            style={{ backgroundImage: 'none' }}
                            to={link.to}
                            title={navCollapsed ? link.label : undefined}
                            className={className}
                          >
                            {content}
                          </Link>
                        ) : (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ backgroundImage: 'none' }}
                            title={navCollapsed ? link.label : undefined}
                            className={className}
                          >
                            {content}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
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
    </RootDisplay>
  );
}
