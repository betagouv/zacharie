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
import TrichineLayout from '@app/routes/trichine/trichine-layout';
import TrichineIndex from '@app/routes/trichine/trichine-index';
import TrichinePrelevementWizard from '@app/routes/trichine/trichine-prelevement-wizard';
import TrichineEchantillons from '@app/routes/trichine/trichine-echantillons';
import TrichineEchantillonDetail from '@app/routes/trichine/trichine-echantillon-detail';
import TrichinePools from '@app/routes/trichine/trichine-pools';
import TrichinePoolDetail from '@app/routes/trichine/trichine-pool-detail';
import TrichineFTPs from '@app/routes/trichine/trichine-ftps';
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
            element={<TrichineLayout />}
          >
            <Route
              index
              element={<TrichineIndex />}
            />
            <Route
              path="echantillons"
              element={<TrichineEchantillons />}
            />
            <Route
              path="echantillons/:reference"
              element={<TrichineEchantillonDetail />}
            />
            <Route
              path="pools"
              element={<TrichinePools />}
            />
            <Route
              path="pools/:reference"
              element={<TrichinePoolDetail />}
            />
            <Route
              path="pools/:reference/2e-intention"
              element={<TrichinePrelevementWizard />}
            />
            <Route
              path="ftp"
              element={<TrichineFTPs />}
            />
            <Route
              path="ftp/:reference"
              element={<TrichineFTPDetail />}
            />
            <Route
              path="prelever"
              element={<TrichinePrelevementWizard />}
            />
            <Route
              path="nouveau-pool"
              element={<TrichineNouveauPool />}
            />
            <Route
              path="nouvelle-ftp"
              element={<TrichineNouvelleFTP />}
            />
          </Route>
        </>
      )}
    </Route>
  );
}
