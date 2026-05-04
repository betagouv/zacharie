import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FrcLayout from './frc-layout';
import FrcTableauDeBord from './frc-tableau-de-bord';

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
        element={<FrcTableauDeBord />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
    </Route>
  );
}
