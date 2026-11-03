/// <reference types="vite/client" />
import { useEffect, type ReactNode } from 'react';
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useRouter } from '@tanstack/react-router';
import { getMe, logout } from '../functions';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex' },
      { title: 'Bac à sable API Zacharie' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async () => ({ user: await getMe() }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  // repère pour les tests e2e : avant l'hydratation, un clic soumettrait les formulaires sans React
  useEffect(() => document.documentElement.setAttribute('data-hydrated', 'true'), []);
  return (
    <>
      <div className="playground-banner">
        BAC À SABLE — environnement de test de l'API Zacharie, pas un vrai service. Données fictives
        uniquement.
      </div>
      <header className="fr-header">
        <div className="fr-header__body">
          <div className="fr-container">
            <div className="fr-header__body-row">
              <div className="fr-header__brand">
                <div className="fr-header__service">
                  <Link to="/">
                    <p className="fr-header__service-title">Bac à sable API Zacharie</p>
                  </Link>
                  <p className="fr-header__service-tagline">
                    Simule une application tierce qui utilise une clé API Zacharie
                  </p>
                </div>
              </div>
              {user && (
                <div className="fr-header__tools">
                  <div className="fr-header__tools-links">
                    <ul className="fr-btns-group">
                      <li>
                        <span className="fr-btn fr-icon-user-line">{user.email}</span>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="fr-btn"
                          onClick={async () => {
                            await logout();
                            await router.invalidate();
                            await router.navigate({ to: '/connexion' });
                          }}
                        >
                          Se déconnecter
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="fr-container fr-my-6w">
        <Outlet />
      </main>
    </>
  );
}
