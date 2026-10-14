import { Route } from 'react-router';
import Contact from '@app/routes/contact';
import LaboratoireLayout from './laboratoire-layout';
import LaboratoireIndex from './laboratoire-index';
import LaboratoireFTPs from './laboratoire-ftps';
import LaboratoireFTP from './laboratoire-ftp';
import LaboratoireProfil from './laboratoire-profil';
import LaboratoireResultsImport from './laboratoire-results-import';
import LaboratoirePools from './laboratoire-pools';
import LaboratoireEchantillons from './laboratoire-echantillons';
import LaboratoirePoolDetail from './laboratoire-pool-detail';

export default function RouterLaboratoire() {
  return (
    <Route
      path="laboratoire"
      element={<LaboratoireLayout />}
    >
      <Route
        index
        element={<LaboratoireIndex />}
      />
      <Route
        path="ftp"
        element={<LaboratoireFTPs />}
      />
      <Route
        path="ftp/:reference"
        element={<LaboratoireFTP />}
      />
      <Route
        path="results/import"
        element={<LaboratoireResultsImport />}
      />
      <Route
        path="pools"
        element={<LaboratoirePools />}
      />
      <Route
        path="pools/:reference"
        element={<LaboratoirePoolDetail />}
      />
      <Route
        path="echantillons"
        element={<LaboratoireEchantillons />}
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
