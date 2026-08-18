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
import TrichineTableau from '@app/routes/trichine/trichine-tableau';
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
