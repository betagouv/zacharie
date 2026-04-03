import { Routes, Route, Outlet, useNavigate, useLocation } from 'react-router';
import LandingPage from './routes/landing';
import RootDisplay from './components/RootDisplay';
import Connexion from './routes/connexion';
import CreationDeCompte from './routes/connexion/creation-de-compte';
import MotDePasseOublie from './routes/connexion/mot-de-passe-oublie';
import ResetMotDePasse from './routes/connexion/reset-mot-de-passe';
import { useEffect, type ReactElement } from 'react';
import Chargement from './components/Chargement';
import TableauDeBordIndex from './routes/tableau-de-bord';
import TableauDeBordLayout from './routes/tableau-de-bord-layout';
import { useMostFreshUser } from './utils-offline/get-most-fresh-user';
import Fei from './routes/fei/fei';
import OfflineMode from './components/OfflineMode';
import SviInspectionCarcasse from './routes/svi-inspection-carcasse/svi-inspection-carcasse';
import * as Sentry from '@sentry/react';
import { capture } from './services/sentry';
import { UserRoles } from '@prisma/client';
import MentionsLegales from './routes/mentions-legales';
import ModalitesDutilisation from './routes/modalites-d-utilisation';
import RegistreCarcasses from './routes/registre-carcasses';
import Accessibility from './routes/accessibility';
import Stats from './routes/stats';
import Contact from './routes/contact';
import Faq from './routes/faq';
import useLoggedInNavigationMenu, { useLandingPageNavigationMenu } from './utils/get-navigation-menu';
import LandingProsPage from './routes/landing-pros';
import LandingDemarchesPage from './routes/landing-demarches';
import PolitiqueDeConfidentialite from './routes/politique-de-confidentialite';
import DeactivatedAccount from './routes/deactivated';
import { hasAllRequiredFields } from './utils/user';
import { MatomoTracker } from './components/MatomoTracker';
import ImpactMatrix from './components/ImpactMatrix';

// mon profil routes
import MesRoles from './routes/mon-profil/1-mon-activite';
import MesCoordonnees from './routes/mon-profil/2-mes-coordonnees';
import MesInformationsDeChasse from './routes/mon-profil/3-mes-informations-de-chasse';
import MonEntreprise from './routes/mon-profil/3-mon-entreprise';
import UtilisateursDeMonEntreprise from './routes/mon-profil/3-utilisateurs-de-mon-entreprise';
import MesNotifications from './routes/mon-profil/4-mes-notifications';
import PartageDeMesDonnees from './routes/mon-profil/partage-de-mes-donnees';
import CCGEdit from './routes/mon-profil/ccg-edit';

// onboarding routes
import OnboardingMesRoles from './routes/onboarding/1-mon-activite';
import OnboardingMesCoordonnees from './routes/onboarding/2-mes-coordonnees';
import OnboardingExaminateurInitial from './routes/onboarding/3a-examinateur-initial';
import OnboardingMesInformationsDeChasse from './routes/onboarding/3b-mes-informations-de-chasse';
import OnboardingMonEntreprise from './routes/onboarding/3-mon-entreprise';
import OnboardingMesNotifications from './routes/onboarding/4-mes-notifications';
import RouterAdmin from './routes/admin/admin-router';
import RouterChasseur from './routes/chasseur/chasseur-router';
import NouvelleFiche from './routes/nouvelle-fiche';
import useZustandStore from './zustand/store';

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
        {/* pages de présentation, publiques */}
        <Route
          path="/"
          element={
            <RootDisplay id="landing" navigation={landingPageNavigationMenu}>
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
        {/* app */}
        <Route path="app" element={<AppLayout />}>
          {/* pages publiques */}
          <>{RouterConnexion()}</>
          <>{RouterChasseur()}</>
          <Route
            path="contact"
            element={
              <RootDisplay id="contact" navigation={generalNavigation}>
                <Contact />
              </RootDisplay>
            }
          />
          {/* nouvelle-fiche is a public route for the api access token */}
          <Route path="nouvelle-fiche" element={<NouvelleFiche />} />
          <Route
            path="tableau-de-bord"
            element={
              <RestrictedRoute id="tableau-de-bord-layout">
                <TableauDeBordLayout navigation={generalNavigation} />
              </RestrictedRoute>
            }
          >
            <Route
              path="/app/tableau-de-bord"
              element={
                <RestrictedRoute id="tableau-de-bord-path">
                  <TableauDeBordIndex />
                </RestrictedRoute>
              }
            />
            <>{RouterOnboarding()}</>
            <Route
              path="fei/:fei_numero"
              element={
                <RestrictedRoute id="fei_numero">
                  <Fei />
                </RestrictedRoute>
              }
            />
            <Route
              path="registre-carcasses"
              element={
                <RestrictedRoute id="registre-carcasses">
                  <RegistreCarcasses />
                </RestrictedRoute>
              }
            />
            <Route
              path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <SviInspectionCarcasse />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mon-activite"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesRoles />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-coordonnees"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesCoordonnees />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-informations-de-chasse"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesInformationsDeChasse
                    withExaminateurInitial
                    withAssociationsDeChasse
                    withCCGs
                    withPartenaires
                  />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-associations-de-chasse"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesInformationsDeChasse withAssociationsDeChasse />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-partenaires"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesInformationsDeChasse withPartenaires />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-ccgs"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesInformationsDeChasse withCCGs />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-ccgs/:entityId"
              element={
                <RestrictedRoute id="ccg-edit">
                  <CCGEdit />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mon-entreprise"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MonEntreprise />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-entreprise/informations"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MonEntreprise />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-entreprise/utilisateurs"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <UtilisateursDeMonEntreprise />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/mes-notifications"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesNotifications />
                </RestrictedRoute>
              }
            />
            <Route
              path="mon-profil/partage-de-mes-donnees"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <PartageDeMesDonnees />
                </RestrictedRoute>
              }
            />
          </Route>
          <>{RouterAdmin()}</>
        </Route>
      </SentryRoutes>
      <MatomoTracker />
      <OfflineMode />
    </>
  );
}

function RouterConnexion() {
  const landingPageNavigationMenu = useLandingPageNavigationMenu();
  return (
    <Route path="connexion" element={<Outlet />}>
      <Route
        index
        element={
          <RootDisplay id="connexion" navigation={landingPageNavigationMenu}>
            <Connexion />
          </RootDisplay>
        }
      />
      <Route
        path="creation-de-compte"
        element={
          <RootDisplay id="creation-de-compte" navigation={landingPageNavigationMenu}>
            <CreationDeCompte />
          </RootDisplay>
        }
      />
      <Route
        path="mot-de-passe-oublie"
        element={
          <RootDisplay id="mot-de-passe-oublie" navigation={landingPageNavigationMenu}>
            <MotDePasseOublie />
          </RootDisplay>
        }
      />

      <Route
        path="reset-mot-de-passe"
        element={
          <RootDisplay id="reset-mot-de-passe" navigation={landingPageNavigationMenu}>
            <ResetMotDePasse />
          </RootDisplay>
        }
      />
    </Route>
  );
}

function RouterOnboarding() {
  return (
    <Route
      path="onboarding"
      element={
        <RestrictedRoute id="onboarding">
          <Outlet />
        </RestrictedRoute>
      }
    >
      <Route path="mon-activite" element={<OnboardingMesRoles />} />
      <Route path="mes-coordonnees" element={<OnboardingMesCoordonnees />} />
      <Route path="formation-examen-initial" element={<OnboardingExaminateurInitial />} />
      <Route path="mes-informations-de-chasse" element={<OnboardingMesInformationsDeChasse />} />
      <Route path="mon-entreprise" element={<OnboardingMonEntreprise />} />
      <Route path="mes-notifications" element={<OnboardingMesNotifications />} />
    </Route>
  );
}

function AppLayout() {
  const generalNavigation = useLoggedInNavigationMenu();
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  if (!_hasHydrated) {
    return (
      <RootDisplay id="app-layout" navigation={generalNavigation}>
        <Chargement />
      </RootDisplay>
    );
  }
  return <Outlet />;
}

function RestrictedRoute({
  children,
  id,
  zacharieAdmin = false,
}: {
  children: ReactElement;
  id: string;
  zacharieAdmin?: boolean;
}) {
  const user = useMostFreshUser('RestrictedRoute ' + id);
  const navigate = useNavigate();
  const location = useLocation();

  // console.log(id, 'restricted route user', user);

  useEffect(() => {
    if (!user?.id) {
      const currentPath = location.pathname + location.search;
      console.log('CONNEXION REQUIRED because no user');
      navigate(`/app/connexion?redirect=${encodeURIComponent(currentPath)}`);
    }
    if (zacharieAdmin && !user?.isZacharieAdmin) {
      const currentPath = location.pathname + location.search;
      console.log('CONNEXION REQUIRED because no zacharieAdmin');
      navigate(`/app/connexion?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, navigate, zacharieAdmin, location]);

  if (!user?.id) {
    return <Chargement />;
  }

  const isRestrictedPage =
    !location.pathname.includes('mon-profil') &&
    !location.pathname.includes('onboarding') &&
    !location.pathname.includes('admin');

  if (isRestrictedPage) {
    const needToCompleteExaminateurInitial =
      user?.roles.includes(UserRoles.CHASSEUR) && user?.est_forme_a_l_examen_initial == null;
    const isProfileCompleted = hasAllRequiredFields(user!) && !needToCompleteExaminateurInitial;

    if (!isProfileCompleted) {
      return <DeactivatedAccount />;
    }
  }

  return children;
}

function TestSentry() {
  useEffect(() => {
    capture('Test Sentry');
  }, []);
  return <div>Test Sentry</div>;
}

export default App;
