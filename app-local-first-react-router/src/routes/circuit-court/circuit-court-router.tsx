import { Outlet, Route } from 'react-router';
import CollecteurLayout from './circuit-court-layout';
import Contact from '@app/routes/contact';
import CircuitCourtOnboardingCoordonnees from './onboarding/1-coordonnees';
import CircuitCourtOnboardingEntreprise from './onboarding/2-entreprise';
import CircuitCourtProfilCoordonnees from './profil/circuit-court-coordonnees';
import CircuitCourtProfilEntreprise from './profil/circuit-court-entreprise';
import CircuitCourtProfilNotifications from './profil/circuit-court-notifications';
import CircuitCourtProfilEntrepriseUtilisateurs from './profil/circuit-court-entreprise-utilisateurs';
import CircuitCourtFei from './circuit-court-fei';
import CircuitCourtFiches from './circuit-court-fiches';

export default function RouterCircuitCourt() {
  return (
    <Route path="circuit-court" element={<CollecteurLayout />}>
      <Route index element={<CircuitCourtFiches />} />
      <Route path="contact" element={<Contact />} />
      <Route path="onboarding" element={<Outlet />}>
        <Route path="coordonnees" element={<CircuitCourtOnboardingCoordonnees />} />
        <Route path="entreprise" element={<CircuitCourtOnboardingEntreprise />} />
      </Route>
      <Route path="profil" element={<Outlet />}>
        <Route path="coordonnees" element={<CircuitCourtProfilCoordonnees />} />
        <Route path="notifications" element={<CircuitCourtProfilNotifications />} />
      </Route>
      <Route path="entreprise" element={<Outlet />}>
        <Route path="informations" element={<CircuitCourtProfilEntreprise />} />
        <Route path="utilisateurs" element={<CircuitCourtProfilEntrepriseUtilisateurs />} />
      </Route>
      <Route path="fei/:fei_numero" element={<CircuitCourtFei />} />
    </Route>
  );
}
