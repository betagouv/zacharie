import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FrcLayout from './frc-layout';
import FederationTableauDeBord from '../federation/federation-tableau-de-bord';

export default function RouterFrc() {
  return (
    <Route
      path="frc"
      element={<FrcLayout />}
    >
      <Route
        index
        element={
          <Navigate
            to="/app/frc/tableau-de-bord"
            replace
          />
        }
      />
      <Route
        path="tableau-de-bord"
        element={<FederationTableauDeBord />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
    </Route>
  );
}
