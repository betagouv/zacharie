import { BrowserRouter, Routes, Route, Outlet, useNavigate } from 'react-router';
import LandingPage from './routes/landing';
import RootDisplay from './components/RootDisplay';
import Connexion from './routes/connexion';
import { useEffect, type ReactElement } from 'react';
import Chargement from './components/Chargement';
import TableauDeBordIndex from './routes/tableau-de-bord';
import TableauDeBordLayout from './routes/tableau-de-bord-layout';
import { getMostFreshUser } from './utils-offline/get-most-fresh-user';
import Fei from './routes/fei/fei';

// const Route = Sentry.withSentryRouting(Route);

function App() {
  return (
    <>
      <BrowserRouter>
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
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
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
