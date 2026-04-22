import { Route, Outlet } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import { useLandingPageNavigationMenu } from '@app/utils/get-navigation-menu';
import Connexion from '.';
import CreationDeCompte from './creation-de-compte';
import MotDePasseOublie from './mot-de-passe-oublie';
import ResetMotDePasse from './reset-mot-de-passe';
import Invitation from './invitation';

export default function RouterConnexion() {
  const landingPageNavigationMenu = useLandingPageNavigationMenu();
  return (
    <Route
      path="connexion"
      element={
        <RootDisplay
          id="connexion"
          navigation={landingPageNavigationMenu}
          mainLink="/app/tableau-de-bord"
        >
          <Outlet />
        </RootDisplay>
      }
    >
      <Route
        index
        element={<Connexion />}
      />
      <Route
        path="creation-de-compte"
        element={<CreationDeCompte />}
      />
      <Route
        path="invitation"
        element={<Invitation />}
      />
      <Route
        path="mot-de-passe-oublie"
        element={<MotDePasseOublie />}
      />
      <Route
        path="reset-mot-de-passe"
        element={<ResetMotDePasse />}
      />
    </Route>
  );
}
