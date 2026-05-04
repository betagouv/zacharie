import { Routes, Route, Outlet } from 'react-router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { capture } from './services/sentry';
import RootDisplay from './components/RootDisplay';
import Chargement from './components/Chargement';
import OfflineMode from './components/OfflineMode';
import { MatomoTracker } from './components/MatomoTracker';
import ImpactMatrix from './components/ImpactMatrix';
import { useLandingPageNavigationMenu } from './utils/get-navigation-menu';
import useZustandStore from './zustand/store';

// landing pages
import LandingPage from './routes/landing';
import LandingProsPage from './routes/landing-pros';
import LandingDemarchesPage from './routes/landing-demarches';
import MentionsLegales from './routes/mentions-legales';
import ModalitesDutilisation from './routes/modalites-d-utilisation';
import PolitiqueDeConfidentialite from './routes/politique-de-confidentialite';
import Accessibility from './routes/accessibility';
import Stats from './routes/stats';
import Contact from './routes/contact';
import Faq from './routes/faq';

import RouterConnexion from './routes/connexion/connexion-router';
import RouterSvi from './routes/svi/svi-router';
import RouterChasseur from './routes/chasseur/chasseur-router';
import RouterCollecteur from './routes/collecteur/collecteur-router';
import RouterEtg from './routes/etg/etg-router';
import RouterTableauDeBordRedirect from './routes/tableau-de-bord-redirect';
import RouterAdmin from './routes/admin/admin-router';
import NouvelleFiche from './routes/nouvelle-fiche';
import RouterCircuitCourt from './routes/circuit-court/circuit-court-router';
import NotFoundRoute from './routes/not-found';

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    onNativePushToken: (token: string) => void;
    onAppVersion: (version: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNotificationReceived: (notification: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNotificationResponseReceived: (response: any) => void;
  }
}

function App() {
  const landingPageNavigationMenu = useLandingPageNavigationMenu();
  return (
    <>
      <SentryRoutes>
        <Route
          path="/"
          element={
            <RootDisplay
              id="landing"
              navigation={landingPageNavigationMenu}
              mainLink="/app/connexion"
            >
              <Outlet />
            </RootDisplay>
          }
        >
          <Route
            index
            element={<LandingPage />}
          />
          <Route
            path="pros"
            element={<LandingProsPage />}
          />
          <Route
            path="demarches"
            element={<LandingDemarchesPage />}
          />
          <Route
            path="test-sentry"
            element={<TestSentry />}
          />
          <Route
            path="mentions-legales"
            element={<MentionsLegales />}
          />
          <Route
            path="accessibilite"
            element={<Accessibility />}
          />
          <Route
            path="politique-de-confidentialite"
            element={<PolitiqueDeConfidentialite />}
          />
          <Route
            path="modalites-d-utilisation"
            element={<ModalitesDutilisation />}
          />
          <Route
            path="stats"
            element={<Stats />}
          />
          <Route
            path="stats/matrice-impact"
            element={<ImpactMatrix />}
          />
          <Route
            path="contact"
            element={<Contact />}
          />
          <Route
            path="faq"
            element={<Faq />}
          />
        </Route>
        <Route
          path="app"
          element={<AppLayout />}
        >
          {RouterConnexion()}
          {RouterChasseur()}
          {RouterEtg()}
          {RouterCollecteur()}
          {RouterTableauDeBordRedirect()}
          {RouterCircuitCourt()}
          {RouterSvi()}
          {RouterAdmin()}
          <Route
            path="contact"
            element={
              <RootDisplay
                id="contact"
                navigation={landingPageNavigationMenu}
                mainLink="/app/connexion"
              >
                <Contact />
              </RootDisplay>
            }
          />
          <Route
            path="nouvelle-fiche"
            element={<NouvelleFiche />}
          />
          <Route
            path="404"
            element={<NotFoundRoute />}
          />
          <Route
            path="*"
            element={<NotFoundRoute />}
          />
        </Route>
        <Route
          path="*"
          element={<NotFoundRoute />}
        />
      </SentryRoutes>
      <MatomoTracker />
      <OfflineMode />
    </>
  );
}

// TODO: delete this and use each role's layout component instead
function AppLayout() {
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  if (!_hasHydrated) {
    return (
      <RootDisplay
        id="app-layout"
        mainLink="/app/connexion"
      >
        <Chargement />
      </RootDisplay>
    );
  }
  return <Outlet />;
}

function TestSentry() {
  useEffect(() => {
    capture('Test Sentry');
  }, []);
  return <div>Test Sentry</div>;
}

export default App;
