import { Outlet, Route } from 'react-router';
import SviLayout from './svi-layout';
import SviDashboard from './svi-dashboard';
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
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';
import TrichineTableau from '@app/routes/trichine/trichine-tableau';
import TrichineNouveauPool from '@app/routes/trichine/trichine-nouveau-pool';
import TrichineNouvelleFTP from '@app/routes/trichine/trichine-nouvelle-ftp';
import TrichineFTPDetail from '@app/routes/trichine/trichine-ftp-detail';
import ChangerMonMotDePasse from '@app/routes/profil/changer-mon-mot-de-passe';

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
        path="tableau-de-bord"
        element={<SviDashboard />}
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
          path="mot-de-passe"
          element={<ChangerMonMotDePasse />}
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
        path="fei/:fei_numero/:premier_detenteur_prochain_detenteur_id_cache"
        element={<SviFei />}
      />
      <Route
        path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
        element={<SviInspectionCarcasseLoader />}
      />
      {/* Espace trichine SVI (circuit agréé) — invisible tant que le feature flag n'est pas activé */}
      {TRICHINE_FEATURE_ENABLED && (
        <>
          <Route
            path="trichine"
            element={<TrichineTableau />}
          />
          <Route
            path="trichine/nouveau-pool"
            element={<TrichineNouveauPool />}
          />
          <Route
            path="trichine/nouvelle-ftp"
            element={<TrichineNouvelleFTP />}
          />
          <Route
            path="trichine/ftp/:ftp_id"
            element={<TrichineFTPDetail />}
          />
        </>
      )}
    </Route>
  );
}
