import { Outlet, Route } from 'react-router';
import EtgLayout from './etg-layout';
import EtgFiches from './etg-fiches';
import Contact from '@app/routes/contact';
import EtgCarcasses from './etg-carcasses';
import EtgOnboardingCoordonnees from './onboarding/1-coordonnees';
import EtgOnboardingEntreprise from './onboarding/2-entreprise';
import EtgProfilCoordonnees from './profil/etg-coordonnees';
import EtgProfilEntreprise from './profil/etg-entreprise';
import EtgProfilNotifications from './profil/etg-notifications';
import EtgProfilPartageDeMesDonnees from './profil/etg-partage-de-mes-donnees';
import EtgProfilEntrepriseUtilisateurs from './profil/etg-entreprise-utilisateurs';
import EtgFei from './etg-fei';
import { SviInspectionCarcasse } from './etg-carcasse-after-svi-inspection';

export default function RouterEtg() {
  return (
    <Route path="etg" element={<EtgLayout />}>
      <Route index element={<EtgFiches />} />
      <Route path="contact" element={<Contact />} />
      <Route path="carcasses" element={<EtgCarcasses />} />
      <Route path="onboarding" element={<Outlet />}>
        <Route path="coordonnees" element={<EtgOnboardingCoordonnees />} />
        <Route path="entreprise" element={<EtgOnboardingEntreprise />} />
      </Route>
      <Route path="profil" element={<Outlet />}>
        <Route path="coordonnees" element={<EtgProfilCoordonnees />} />
        <Route path="notifications" element={<EtgProfilNotifications />} />
        <Route path="partage-de-mes-donnees" element={<EtgProfilPartageDeMesDonnees />} />
      </Route>
      <Route path="entreprise" element={<Outlet />}>
        <Route path="informations" element={<EtgProfilEntreprise />} />
        <Route path="utilisateurs" element={<EtgProfilEntrepriseUtilisateurs />} />
      </Route>
      <Route path="fei/:fei_numero" element={<EtgFei />} />
      <Route path="carcasse-svi/:fei_numero/:zacharie_carcasse_id" element={<SviInspectionCarcasse />} />
    </Route>
  );
}
