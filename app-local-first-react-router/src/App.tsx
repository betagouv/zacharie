import { Routes, Route, Outlet, useNavigate } from 'react-router';
import LandingPage from './routes/landing';
import RootDisplay from './components/RootDisplay';
import Connexion from './routes/connexion';
import { useEffect, type ReactElement } from 'react';
import Chargement from './components/Chargement';
import TableauDeBordIndex from './routes/tableau-de-bord';
import TableauDeBordLayout from './routes/tableau-de-bord-layout';
import { getMostFreshUser } from './utils-offline/get-most-fresh-user';
import Fei from './routes/fei/fei';
import OfflineMode from './components/OfflineMode';
import Carcasse from './routes/carcasse';
import CarcasseEditSVI from './routes/carcasse-svi';
import MesRoles from './routes/mon-profil/mes-roles';
import MesCCGs from './routes/mon-profil/mes-ccgs';
import MesInformations from './routes/mon-profil/mes-informations';
import MesNotifications from './routes/mon-profil/mes-notifications';
// const Route = Sentry.withSentryRouting(Route);

function App() {
  return (
    <>
      <OfflineMode />
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="app" element={<Outlet />}>
          <Route
            path="connexion"
            element={
              <RootDisplay id="connexion">
                <Connexion />
              </RootDisplay>
            }
          />
          <Route
            element={
              <RestrictedRoute id="tableau-de-bord-layout">
                <TableauDeBordLayout />
              </RestrictedRoute>
            }
          >
            <Route
              path="tableau-de-bord"
              element={
                <RestrictedRoute id="tableau-de-bord-path">
                  <TableauDeBordIndex />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/fei/:fei_numero"
              element={
                <RestrictedRoute id="fei_numero">
                  <Fei />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/carcasse/:fei_numero/:zacharie_carcasse_id"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <Carcasse />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/carcasse-svi/:fei_numero/:zacharie_carcasse_id"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <CarcasseEditSVI />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/mon-profil/mes-roles"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesRoles />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/mon-profil/mes-informations"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesInformations />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/mon-profil/mes-ccgs"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesCCGs />
                </RestrictedRoute>
              }
            />
            <Route
              path="tableau-de-bord/mon-profil/mes-notifications"
              element={
                <RestrictedRoute id="zacharie_carcasse_id">
                  <MesNotifications />
                </RestrictedRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

function RestrictedRoute({ children, id }: { children: ReactElement; id: string }) {
  const user = getMostFreshUser('RestrictedRoute ' + id);
  const navigate = useNavigate();

  // console.log(id, 'restricted route user', user);

  useEffect(() => {
    if (!user?.id) {
      navigate('/app/connexion?type=compte-existant');
    }
  }, [user, navigate]);

  if (!user?.id) {
    return <Chargement />;
  }

  return children;
}

export default App;
