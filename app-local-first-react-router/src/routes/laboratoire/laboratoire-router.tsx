import { Navigate, Route } from 'react-router';
import Contact from '@app/routes/contact';
import LaboratoireLayout from './laboratoire-layout';
import LaboratoireFTPs from './laboratoire-ftps';
import LaboratoireFTP from './laboratoire-ftp';
import LaboratoireProfil from './laboratoire-profil';

export default function RouterLaboratoire() {
  return (
    <Route
      path="laboratoire"
      element={<LaboratoireLayout />}
    >
      <Route
        index
        element={
          <Navigate
            to="/app/laboratoire/ftp"
            replace
          />
        }
      />
      <Route
        path="ftp"
        element={<LaboratoireFTPs />}
      />
      <Route
        path="ftp/:ftp_id"
        element={<LaboratoireFTP />}
      />
      <Route
        path="profil"
        element={<LaboratoireProfil />}
      />
      <Route
        path="contact"
        element={<Contact />}
      />
    </Route>
  );
}
