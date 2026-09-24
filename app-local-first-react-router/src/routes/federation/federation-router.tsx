import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FederationTableauDeBord from '@app/components/FederationTableauDeBord';
import ChangerMonMotDePasse from '@app/routes/profil/changer-mon-mot-de-passe';
import FederationLayout from './federation-layout';
import FederationCoordonnees from './federation-coordonnees';
import FederationMaFederation from './federation-ma-federation';

export default function RouterFederation() {
  return (
    <Route
      path="federation"
      element={<FederationLayout />}
    >
      <Route
        index
        element={
          <Navigate
            to="/app/federation/tableau-de-bord"
            replace
          />
        }
      />
      <Route
        path="onboarding/coordonnees"
        element={<FederationCoordonnees onboarding />}
      />
      <Route
        path="tableau-de-bord"
        element={<FederationTableauDeBord />}
      />
      <Route
        path="profil/ma-federation"
        element={<FederationMaFederation />}
      />
      <Route
        path="profil/coordonnees"
        element={<FederationCoordonnees />}
      />
      <Route
        path="profil/mot-de-passe"
        element={<ChangerMonMotDePasse />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
    </Route>
  );
}
