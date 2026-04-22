import { Outlet, Route } from 'react-router';
import SviLayout from './svi-layout';
import SviFiches from './svi-fiches';
import Contact from '@app/routes/contact';
import SviCarcasses from './svi-carcasses';
import SviOnboardingCoordonnees from './onboarding/1-coordonnees';
import SviOnboardingEntreprise from './onboarding/2-entreprise';
import SviProfilCoordonnees from './profil/svi-coordonnees';
import SviProfilEntreprise from './profil/svi-entreprise';
import SviProfilNotifications from './profil/svi-notifications';
import SviProfilEntrepriseUtilisateurs from './profil/svi-entreprise-utilisateurs';
import SviFei from './svi-fei';
import SviInspectionCarcasseLoader from './svi-carcasse-svi-inspection';

export default function RouterSvi() {
  return (
    <Route
      path="svi"
      element={<SviLayout />}
    >
      <Route
        index
        element={<SviFiches />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
      <Route
        path="carcasses"
        element={<SviCarcasses />}
      />
      <Route
        path="onboarding"
        element={<Outlet />}
      >
        <Route
          path="coordonnees"
          element={<SviOnboardingCoordonnees />}
        />
        <Route
          path="entreprise"
          element={<SviOnboardingEntreprise />}
        />
      </Route>
      <Route
        path="profil"
        element={<Outlet />}
      >
        <Route
          path="coordonnees"
          element={<SviProfilCoordonnees />}
        />
        <Route
          path="notifications"
          element={<SviProfilNotifications />}
        />
      </Route>
      <Route
        path="entreprise"
        element={<Outlet />}
      >
        <Route
          path="informations"
          element={<SviProfilEntreprise />}
        />
        <Route
          path="utilisateurs"
          element={<SviProfilEntrepriseUtilisateurs />}
        />
      </Route>
      <Route
        path="fei/:fei_numero"
        element={<SviFei />}
      />
      <Route
        path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
        element={<SviInspectionCarcasseLoader />}
      />
    </Route>
  );
}
