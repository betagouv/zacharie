import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FederationTableauDeBord from '@app/components/FederationTableauDeBord';
import ChangerMonMotDePasse from '@app/routes/profil/changer-mon-mot-de-passe';
import FederationLayout from './federation-layout';
import FederationCoordonnees from './federation-coordonnees';
import FederationMaFederation from './federation-ma-federation';
import FederationCCGs from './federation-ccgs';
import ChasseurCCGEdit from '@app/routes/chasseur/profil/chasseur-ccg-edit';
import ChasseurFiches from '@app/routes/chasseur/chasseur-fiches';
import CcgFiche from '@app/routes/ccg/ccg-fiche';

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
        element={<FederationTableauDeBord basePath="/app/federation/tableau-de-bord" />}
      />
      <Route
        path="tableau-de-bord/:federationId"
        element={<FederationTableauDeBord basePath="/app/federation/tableau-de-bord" />}
      />
      <Route
        path="fiches"
        element={<ChasseurFiches basePath="/app/federation/fiches" />}
      />
      <Route
        path="fiches/ccg/:fei_numero"
        element={<CcgFiche basePath="/app/federation/fiches" />}
      />
      <Route
        path="profil/ccgs"
        element={<FederationCCGs />}
      />
      <Route
        path="profil/ccgs/:entityId"
        element={<ChasseurCCGEdit />}
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
