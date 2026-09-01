import { Route, Outlet } from 'react-router';
import Contact from '@app/routes/contact';
import MesChasses from './tableau-de-bord/chasseur-tableau-de-bord';
import PartageDeMesDonnees from './profil/chasseur-partage-de-mes-donnees';
import MesNotifications from './profil/chasseur-notifications';
import MesInformationsDeChasse from './profil/chasseur-informations-de-chasse';
import ChasseurFei from './chasseur-fei';
import ChasseurFeiEnvoyée from './chasseur-fei-envoyée';
import ChasseurFiches from './chasseur-fiches';
import ChasseurLayout from './chasseur-layout';
import ExaminateurCarcasseDetail from './examinateur-carcasse-detail';
import ChasseurOnboardingMesCoordonnees from './onboarding/1-coordonnees';
import ChasseurOnboardingExaminateurInitial from './onboarding/2-examinateur-initial';
import ChasseurCoordonnees from './profil/chasseur-coordonnees';
import ChasseurOnboardingMesInformationsDeChasse from './onboarding/3-informations-de-chasse';
import ChasseurCCGEdit from './profil/chasseur-ccg-edit';
import ChasseurSviInspectionCarcasseLoader from './chasseur-svi-inspection-carcasse';
import ChasseurDemandesDeModification from './chasseur-demandes-de-modification';
import ChasseurDemandeDeModificationDetail from './chasseur-demande-de-modification-detail';
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';
import TrichineLayout from '@app/routes/trichine/trichine-layout';
import TrichineIndex from '@app/routes/trichine/trichine-index';
import TrichineEchantillons from '@app/routes/trichine/trichine-echantillons';
import TrichineEchantillonDetail from '@app/routes/trichine/trichine-echantillon-detail';
import TrichinePools from '@app/routes/trichine/trichine-pools';
import TrichinePoolDetail from '@app/routes/trichine/trichine-pool-detail';
import TrichinePrelevementWizard from '@app/routes/trichine/trichine-prelevement-wizard';
import TrichineFTPs from '@app/routes/trichine/trichine-ftps';
import TrichineNouveauPool from '@app/routes/trichine/trichine-nouveau-pool';
import TrichineNouvelleFTP from '@app/routes/trichine/trichine-nouvelle-ftp';
import TrichineFTPDetail from '@app/routes/trichine/trichine-ftp-detail';
import ChangerMonMotDePasse from '@app/routes/profil/changer-mon-mot-de-passe';

export default function RouterChasseur() {
  return (
    <Route
      path="chasseur"
      element={<ChasseurLayout />}
    >
      <Route
        index
        element={<ChasseurFiches />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
      <Route
        path="onboarding"
        element={<Outlet />}
      >
        <Route
          path="mes-coordonnees"
          element={<ChasseurOnboardingMesCoordonnees />}
        />
        <Route
          path="formation-examen-initial"
          element={<ChasseurOnboardingExaminateurInitial />}
        />
        <Route
          path="mes-informations-de-chasse"
          element={<ChasseurOnboardingMesInformationsDeChasse />}
        />
      </Route>
      <Route
        path="profil"
        element={<Outlet />}
      >
        <Route
          path="coordonnees"
          element={<ChasseurCoordonnees />}
        />
        <Route
          path="mot-de-passe"
          element={<ChangerMonMotDePasse />}
        />
        <Route
          path="informations-de-chasse"
          element={
            <MesInformationsDeChasse
              withExaminateurInitial
              withAssociationsDeChasse
              withCCGs
              withPartenaires
            />
          }
        />
        <Route
          path="associations-de-chasse"
          element={<MesInformationsDeChasse withAssociationsDeChasse />}
        />
        <Route
          path="partenaires"
          element={<MesInformationsDeChasse withPartenaires />}
        />
        <Route
          path="ccgs"
          element={<MesInformationsDeChasse withCCGs />}
        />
        <Route
          path="ccgs/:entityId"
          element={<ChasseurCCGEdit />}
        />
        <Route
          path="notifications"
          element={<MesNotifications />}
        />
        <Route
          path="partage-de-mes-donnees"
          element={<PartageDeMesDonnees />}
        />
      </Route>
      <Route
        path="fiches"
        element={<ChasseurFiches />}
      />
      <Route
        path="fei/:fei_numero"
        element={<ChasseurFei />}
      />
      <Route
        path="fei/:fei_numero/envoyée"
        element={<ChasseurFeiEnvoyée />}
      />
      <Route
        path="carcasse/:fei_numero/:zacharie_carcasse_id"
        element={<ExaminateurCarcasseDetail />}
      />
      <Route
        path="tableau-de-bord"
        element={<MesChasses />}
      />
      <Route
        path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
        element={<ChasseurSviInspectionCarcasseLoader />}
      />
      <Route
        path="demandes-de-modification"
        element={<ChasseurDemandesDeModification />}
      />
      <Route
        path="demandes-de-modification/:request_id"
        element={<ChasseurDemandeDeModificationDetail />}
      />
      {/* Routes invisibles en production tant que le feature flag trichine n'est pas activé */}
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
