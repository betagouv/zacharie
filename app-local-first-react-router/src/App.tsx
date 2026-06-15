import { Routes, Route, Outlet } from 'react-router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { capture } from './services/sentry';
import RootDisplay from './components/RootDisplay';
import OfflineMode from './components/OfflineMode';
import { MatomoTracker } from './components/MatomoTracker';
import ImpactMatrix from './components/ImpactMatrix';
import PageNotFound from './components/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import useLandingPageNavigationMenu from './utils/get-landing-page-navigation-menu';

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
import Quiz from './routes/quiz';
import QuizTv from './routes/quiz-tv';

import RouterConnexion from './routes/connexion/connexion-router';
import RouterSvi from './routes/svi/svi-router';
import RouterChasseur from './routes/chasseur/chasseur-router';
import RouterCollecteur from './routes/collecteur/collecteur-router';
import RouterEtg from './routes/etg/etg-router';
import RouterAdmin from './routes/admin/admin-router';
import NouvelleFiche from './routes/nouvelle-fiche';
import RouterCircuitCourt from './routes/circuit-court/circuit-court-router';
import RouterFdc from './routes/fdc/fdc-router';
import RouterFrc from './routes/frc/frc-router';
import RouterFnc from './routes/fnc/fnc-router';
import useUser from './zustand/user';
import { getUserOnboardingRoute } from './utils/user-onboarded.client';

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
  const user = useUser((state) => state.user);
  // const generalNavigation = useLoggedInNavigationMenu();

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email ?? undefined, role: user.roles?.[0] });
    } else {
      Sentry.setUser(null);
    }
    Sentry.setTag('platform', window.ReactNativeWebView ? 'native' : 'web');
  }, [user]);

  return (
    <>
      <SentryRoutes>
        <Route
          path="/"
          element={
            <RootDisplay
              id="landing"
              navigation={landingPageNavigationMenu}
              mainLink={user ? getUserOnboardingRoute(user) : '/app/connexion'}
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
          <Route
            path="quiz"
            element={<Quiz />}
          />
        </Route>
        <Route
          path="/quiz/tv"
          element={<QuizTv />}
        />
        <Route path="app">
          {RouterConnexion()}
          {RouterChasseur()}
          {RouterEtg()}
          {RouterCollecteur()}
          {RouterCircuitCourt()}
          {RouterSvi()}
          {RouterFdc()}
          {RouterFrc()}
          {RouterFnc()}
          {RouterAdmin()}
          <Route
            path="contact"
            element={
              <RootDisplay
                id="contact"
                // navigation={generalNavigation}
                mainLink={user ? getUserOnboardingRoute(user) : '/app/connexion'}
              >
                <Contact />
              </RootDisplay>
            }
          />
          <Route
            path="nouvelle-fiche"
            element={<NouvelleFiche />}
          />
        </Route>
        <Route
          path="*"
          element={<PageNotFound />}
        />
      </SentryRoutes>
      <ScrollToTop />
      <MatomoTracker />
      <OfflineMode />
    </>
  );
}

function TestSentry() {
  useEffect(() => {
    capture('Test Sentry');
  }, []);
  return <div>Test Sentry</div>;
}

export default App;
