import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FncLayout from './fnc-layout';
import FederationTableauDeBord from '../federation/federation-tableau-de-bord';

export default function RouterFnc() {
  return (
    <Route
      path="fnc"
      element={<FncLayout />}
    >
      <Route
        index
        element={
          <Navigate
            to="/app/fnc/tableau-de-bord"
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
