import { Outlet, Route } from 'react-router';
import CollecteurLayout from './collecteur-layout';
import CollecteurFiches from './collecteur-fiches';
import Contact from '@app/routes/contact';
import CollecteurCarcasses from './collecteur-carcasses';
import CollecteurOnboardingCoordonnees from './onboarding/1-coordonnees';
import CollecteurOnboardingEntreprise from './onboarding/2-entreprise';
import CollecteurProfilCoordonnees from './profil/collecteur-coordonnees';
import CollecteurProfilEntreprise from './profil/collecteur-entreprise';
import CollecteurProfilNotifications from './profil/collecteur-notifications';
import CollecteurProfilPartageDeMesDonnees from './profil/collecteur-partage-de-mes-donnees';
import CollecteurProfilEntrepriseUtilisateurs from './profil/collecteur-entreprise-utilisateurs';
import CollecteurFei from './collecteur-fei';
import { SviInspectionCarcasse } from './collecteur-carcasse-after-svi-inspection';

export default function RouterCollecteur() {
  return (
    <Route
      path="collecteur"
      element={<CollecteurLayout />}
    >
      <Route
        index
        element={<CollecteurFiches />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
      <Route
        path="carcasses"
        element={<CollecteurCarcasses />}
      />
      <Route
        path="onboarding"
        element={<Outlet />}
      >
        <Route
          path="coordonnees"
          element={<CollecteurOnboardingCoordonnees />}
        />
        <Route
          path="entreprise"
          element={<CollecteurOnboardingEntreprise />}
        />
      </Route>
      <Route
        path="profil"
        element={<Outlet />}
      >
        <Route
          path="coordonnees"
          element={<CollecteurProfilCoordonnees />}
        />
        <Route
          path="notifications"
          element={<CollecteurProfilNotifications />}
        />
        <Route
          path="partage-de-mes-donnees"
          element={<CollecteurProfilPartageDeMesDonnees />}
        />
      </Route>
      <Route
        path="entreprise"
        element={<Outlet />}
      >
        <Route
          path="informations"
          element={<CollecteurProfilEntreprise />}
        />
        <Route
          path="utilisateurs"
          element={<CollecteurProfilEntrepriseUtilisateurs />}
        />
      </Route>
      <Route
        path="fei/:fei_numero"
        element={<CollecteurFei />}
      />
      <Route
        path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
        element={<SviInspectionCarcasse />}
      />
    </Route>
  );
}
