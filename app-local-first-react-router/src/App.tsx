import { Routes, Route, Outlet, useNavigate, useLocation } from 'react-router';
import LandingPage from './routes/landing';
import RootDisplay from './components/RootDisplay';
import Connexion from './routes/connexion';
import { useEffect, type ReactElement } from 'react';
import Chargement from './components/Chargement';
import TableauDeBordIndex from './routes/tableau-de-bord';
import TableauDeBordLayout from './routes/tableau-de-bord-layout';
import { useMostFreshUser } from './utils-offline/get-most-fresh-user';
import Fei from './routes/fei/fei';
import OfflineMode from './components/OfflineMode';
import CarcasseExaminateur from './routes/carcasse-examinateur';
import SviInspectionCarcasse from './routes/svi-inspection-carcasse/svi-inspection-carcasse';
import MesRoles from './routes/mon-profil/1-mon-activite';
import MesInformationsDeChasse from './routes/mon-profil/3-mes-informations-de-chasse';
import MesCoordonnees from './routes/mon-profil/2-mes-coordonnees';
import MesNotifications from './routes/mon-profil/4-mes-notifications';
import * as Sentry from '@sentry/react';
import { capture } from './services/sentry';
import { UserRoles } from '@prisma/client';
import AdminUsers from './routes/admin/users';
import AdminNewUser from './routes/admin/user-add';
import AdminUser from './routes/admin/user.$userId';
import AdminNouvelleEntite from './routes/admin/entity-nouvelle';
import AdminEntity from './routes/admin/entity-$entityId';
import AdminEntites from './routes/admin/entities';
import MentionsLegales from './routes/mentions-legales';
import ModalitesDutilisation from './routes/modalites-d-utilisation';
import RegistreCarcasses from './routes/registre-carcasses';
import Accessibility from './routes/accessibility';
import Stats from './routes/stats';
import Contact from './routes/contact';
import { useLandingPageNavigationMenu } from './utils/get-navigation-menu';
import LandingProsPage from './routes/landing-pros';
import LandingDemarchesPage from './routes/landing-demarches';
import AdminApiKeys from './routes/admin/api-keys';
import AdminNewApiKey from './routes/admin/api-key-add';
import AdminApiKey from './routes/admin/api-key.$apiKeyId';
import PartageDeMesDonnees from './routes/mon-profil/partage-de-mes-donnees';
import NouvelleFiche from './routes/nouvelle-fiche';
import MonEntreprise from './routes/mon-profil/3-mon-entreprise';
import PolitiqueDeConfidentialite from './routes/politique-de-confidentialite';
import UtilisateursDeMonEntreprise from './routes/mon-profil/3-utilisateurs-de-mon-entreprise';
import FeiEnvoyée from './routes/fei/envoyée';

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
          <Route path="contact" element={<Contact />} />
        </Route>
        <Route path="app" element={<Outlet />}>
          <Route
            path="connexion"
            element={
              <RootDisplay id="connexion" navigation={landingPageNavigationMenu}>
                <Connexion />
              </RootDisplay>
            }
          />
          <Route path="nouvelle-fiche" element={<NouvelleFiche />} />
          <Route
            path="tableau-de-bord"
            element={
              <RestrictedRoute id="tableau-de-bord-layout">
                <TableauDeBordLayout />
              </RestrictedRoute>
            }
          >
            <Route path="contact" element={<Contact />} />
            <Route
              path="/app/tableau-de-bord"
              element={
                <RestrictedRoute id="tableau-de-bord-path">
                  <TableauDeBordIndex />
                </RestrictedRoute>
              }
            />
            <Route
              path="fei/:fei_numero"
              element={
                <RestrictedRoute id="fei_numero">
                  <Fei />
                </RestrictedRoute>
              }
            />
            <Route
              path="fei/:fei_numero/envoyée"
              element={
                <RestrictedRoute id="fei_numero">
                  <FeiEnvoyée />
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
              path="carcasse/:fei_numero/:zacharie_carcasse_id"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <CarcasseExaminateur />
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
            <Route path="admin" element={<Outlet />}>
              <Route
                path="users"
                element={
                  <RestrictedRoute id="users" roles={[UserRoles.ADMIN]}>
                    <AdminUsers />
                  </RestrictedRoute>
                }
              />
              <Route
                path="add-user"
                element={
                  <RestrictedRoute id="add-user" roles={[UserRoles.ADMIN]}>
                    <AdminNewUser />
                  </RestrictedRoute>
                }
              />
              <Route
                path="user/:userId"
                element={
                  <RestrictedRoute id="user/:userId" roles={[UserRoles.ADMIN]}>
                    <AdminUser />
                  </RestrictedRoute>
                }
              />
              <Route
                path="entities"
                element={
                  <RestrictedRoute id="entities" roles={[UserRoles.ADMIN]}>
                    <AdminEntites />
                  </RestrictedRoute>
                }
              />
              <Route
                path="add-entity"
                element={
                  <RestrictedRoute id="add-entity" roles={[UserRoles.ADMIN]}>
                    <AdminNouvelleEntite />
                  </RestrictedRoute>
                }
              />
              <Route
                path="entity/:entityId"
                element={
                  <RestrictedRoute id="entity/:entityId" roles={[UserRoles.ADMIN]}>
                    <AdminEntity />
                  </RestrictedRoute>
                }
              />
              <Route
                path="api-keys"
                element={
                  <RestrictedRoute id="api-keys" roles={[UserRoles.ADMIN]}>
                    <AdminApiKeys />
                  </RestrictedRoute>
                }
              />
              <Route
                path="api-key-add"
                element={
                  <RestrictedRoute id="api-key-add" roles={[UserRoles.ADMIN]}>
                    <AdminNewApiKey />
                  </RestrictedRoute>
                }
              />
              <Route
                path="api-key/:apiKeyId"
                element={
                  <RestrictedRoute id="api-key/:apiKeyId" roles={[UserRoles.ADMIN]}>
                    <AdminApiKey />
                  </RestrictedRoute>
                }
              />
            </Route>
          </Route>
        </Route>
      </SentryRoutes>
      <OfflineMode />
    </>
  );
}

function RestrictedRoute({
  children,
  id,
  roles = [],
}: {
  children: ReactElement;
  id: string;
  roles?: UserRoles[];
}) {
  const user = useMostFreshUser('RestrictedRoute ' + id);
  const navigate = useNavigate();
  const location = useLocation();

  // console.log(id, 'restricted route user', user);

  useEffect(() => {
    if (!user?.id) {
      const currentPath = location.pathname + location.search;
      navigate(`/app/connexion?type=compte-existant&redirect=${encodeURIComponent(currentPath)}`);
    }
    if (roles.length > 0 && !roles.some((role) => user?.roles.includes(role))) {
      const currentPath = location.pathname + location.search;
      navigate(`/app/connexion?type=compte-existant&redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, navigate, roles, location]);

  if (!user?.id) {
    return <Chargement />;
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
