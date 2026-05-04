import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import FdcLayout from './fdc-layout';
import FdcTableauDeBord from './fdc-tableau-de-bord';

export default function RouterFdc() {
  return (
    <Route
      path="fdc"
      element={<FdcLayout />}
    >
      <Route
        index
        element={
          <Navigate
            to="/app/fdc/tableau-de-bord"
            replace
          />
        }
      />
      <Route
        path="tableau-de-bord"
        element={<FdcTableauDeBord />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
    </Route>
  );
}
