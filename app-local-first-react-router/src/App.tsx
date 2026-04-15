import { Routes, Route, Outlet } from 'react-router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { capture } from './services/sentry';
import RootDisplay from './components/RootDisplay';
import Chargement from './components/Chargement';
import OfflineMode from './components/OfflineMode';
import { MatomoTracker } from './components/MatomoTracker';
import ImpactMatrix from './components/ImpactMatrix';
import useLoggedInNavigationMenu, { useLandingPageNavigationMenu } from './utils/get-navigation-menu';
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
import RouterTableauDeBord from './routes/tableau-de-bord/tableau-de-bord-router';
import RouterAdmin from './routes/admin/admin-router';
import NouvelleFiche from './routes/nouvelle-fiche';

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
  const generalNavigation = useLoggedInNavigationMenu();
  return (
    <>
      <SentryRoutes>
        <Route
          path="/"
          element={
            <RootDisplay id="landing" navigation={landingPageNavigationMenu} mainLink="/app/tableau-de-bord">
              <Outlet />
            </RootDisplay>
          }
        >
          <Route index element={<LandingPage />} />
          <Route path="pros" element={<LandingProsPage />} />
          <Route path="demarches" element={<LandingDemarchesPage />} />
          <Route path="test-sentry" element={<TestSentry />} />
          <Route path="mentions-legales" element={<MentionsLegales />} />
          <Route path="accessibilite" element={<Accessibility />} />
          <Route path="politique-de-confidentialite" element={<PolitiqueDeConfidentialite />} />
          <Route path="modalites-d-utilisation" element={<ModalitesDutilisation />} />
          <Route path="stats" element={<Stats />} />
          <Route path="stats/matrice-impact" element={<ImpactMatrix />} />
          <Route path="contact" element={<Contact />} />
          <Route path="faq" element={<Faq />} />
        </Route>
        <Route path="app" element={<AppLayout />}>
          {RouterConnexion()}
          {RouterChasseur()}
          {RouterEtg()}
          {RouterCollecteur()}
          {RouterTableauDeBord({ navigation: generalNavigation })}
          {RouterSvi()}
          {RouterAdmin()}
          <Route
            path="contact"
            element={
              <RootDisplay id="contact" navigation={generalNavigation} mainLink="/app/tableau-de-bord">
                <Contact />
              </RootDisplay>
            }
          />
          <Route path="nouvelle-fiche" element={<NouvelleFiche />} />
        </Route>
      </SentryRoutes>
      <MatomoTracker />
      <OfflineMode />
    </>
  );
}

// TODO: delete this and use each role's layout component instead
function AppLayout() {
  const generalNavigation = useLoggedInNavigationMenu();
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  if (!_hasHydrated) {
    return (
      <RootDisplay id="app-layout" navigation={generalNavigation} mainLink="/app/tableau-de-bord">
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
