import { Route, Outlet } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import RestrictedRoute from '@app/components/RestrictedRoute';
import TableauDeBordLayout from '@app/routes/tableau-de-bord-layout';
import TableauDeBordIndex from '@app/routes/tableau-de-bord';
import Fei from '@app/routes/fei/fei';
import SviInspectionCarcasse from '@app/routes/svi-inspection-carcasse/svi-inspection-carcasse';
import RegistreCarcasses from '@app/routes/registre-carcasses';

// onboarding
import OnboardingMesRoles from '@app/routes/onboarding/1-mon-activite';
import OnboardingMesCoordonnees from '@app/routes/onboarding/2-mes-coordonnees';
import OnboardingExaminateurInitial from '@app/routes/onboarding/3a-examinateur-initial';
import OnboardingMesInformationsDeChasse from '@app/routes/onboarding/3b-mes-informations-de-chasse';
import OnboardingMonEntreprise from '@app/routes/onboarding/3-mon-entreprise';
import OnboardingMesNotifications from '@app/routes/onboarding/4-mes-notifications';

// mon profil
import MesRoles from '@app/routes/mon-profil/1-mon-activite';
import MesCoordonnees from '@app/routes/mon-profil/2-mes-coordonnees';
import MesInformationsDeChasse from '@app/routes/mon-profil/3-mes-informations-de-chasse';
import MonEntreprise from '@app/routes/mon-profil/3-mon-entreprise';
import UtilisateursDeMonEntreprise from '@app/routes/mon-profil/3-utilisateurs-de-mon-entreprise';
import MesNotifications from '@app/routes/mon-profil/4-mes-notifications';
import PartageDeMesDonnees from '@app/routes/mon-profil/partage-de-mes-donnees';
import CCGEdit from '@app/routes/mon-profil/ccg-edit';

export default function RouterTableauDeBord({ navigation }: { navigation: MainNavigationProps.Item[] }) {
  return (
    <Route
      path="tableau-de-bord"
      element={
        <RestrictedRoute id="tableau-de-bord-layout">
          <TableauDeBordLayout navigation={navigation} />
        </RestrictedRoute>
      }
    >
      <Route
        path="/app/tableau-de-bord"
        element={
          <RestrictedRoute id="tableau-de-bord-path">
            <TableauDeBordIndex />
          </RestrictedRoute>
        }
      />
      {/* Onboarding */}
      <Route
        path="onboarding"
        element={
          <RestrictedRoute id="onboarding">
            <Outlet />
          </RestrictedRoute>
        }
      >
        <Route path="mon-activite" element={<OnboardingMesRoles />} />
        <Route path="mes-coordonnees" element={<OnboardingMesCoordonnees />} />
        <Route path="formation-examen-initial" element={<OnboardingExaminateurInitial />} />
        <Route path="mes-informations-de-chasse" element={<OnboardingMesInformationsDeChasse />} />
        <Route path="mon-entreprise" element={<OnboardingMonEntreprise />} />
        <Route path="mes-notifications" element={<OnboardingMesNotifications />} />
      </Route>
      <Route
        path="fei/:fei_numero"
        element={
          <RestrictedRoute id="fei_numero">
            <Fei />
          </RestrictedRoute>
        }
      />
      <Route
        path="registre-carcasses"
        element={
          <RestrictedRoute id="registre-carcasses">
            <RegistreCarcasses />
          </RestrictedRoute>
        }
      />
      <Route
        path="carcasse-svi/:fei_numero/:zacharie_carcasse_id"
        element={
          <RestrictedRoute id="zacharie_carcasse_id">
            <SviInspectionCarcasse />
          </RestrictedRoute>
        }
      />
      {/* Mon profil */}
      <Route
        path="mon-profil/mon-activite"
        element={
          <RestrictedRoute id="mon-activite">
            <MesRoles />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-coordonnees"
        element={
          <RestrictedRoute id="mes-coordonnees">
            <MesCoordonnees />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-informations-de-chasse"
        element={
          <RestrictedRoute id="mes-informations-de-chasse">
            <MesInformationsDeChasse
              withExaminateurInitial
              withAssociationsDeChasse
              withCCGs
              withPartenaires
            />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-associations-de-chasse"
        element={
          <RestrictedRoute id="mes-associations-de-chasse">
            <MesInformationsDeChasse withAssociationsDeChasse />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-partenaires"
        element={
          <RestrictedRoute id="mes-partenaires">
            <MesInformationsDeChasse withPartenaires />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-ccgs"
        element={
          <RestrictedRoute id="mes-ccgs">
            <MesInformationsDeChasse withCCGs />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-ccgs/:entityId"
        element={
          <RestrictedRoute id="ccg-edit">
            <CCGEdit />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mon-entreprise"
        element={
          <RestrictedRoute id="mon-entreprise">
            <MonEntreprise />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-entreprise/informations"
        element={
          <RestrictedRoute id="mon-entreprise-informations">
            <MonEntreprise />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-entreprise/utilisateurs"
        element={
          <RestrictedRoute id="mon-entreprise-utilisateurs">
            <UtilisateursDeMonEntreprise />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/mes-notifications"
        element={
          <RestrictedRoute id="mes-notifications">
            <MesNotifications />
          </RestrictedRoute>
        }
      />
      <Route
        path="mon-profil/partage-de-mes-donnees"
        element={
          <RestrictedRoute id="partage-de-mes-donnees">
            <PartageDeMesDonnees />
          </RestrictedRoute>
        }
      />
    </Route>
  );
}
