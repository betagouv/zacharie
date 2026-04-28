import { Route } from 'react-router';
import AdminUsers from './users';
import AdminNewUser from './user-add';
import AdminUser from './user.$userId';
import AdminNouvelleEntite from './entity-nouvelle';
import AdminEntity from './entity-$entityId';
import AdminEntites from './entities';
import AdminApiKeys from './api-keys';
import AdminNewApiKey from './api-key-add';
import AdminApiKey from './api-key.$apiKeyId';
import AdminLayout from './layout';
import AdminCarcasses from './carcasses';
import AdminCarcasseDetail from './carcasse-detail';
import CcgImport from './ccg-import';
import AdminDashboard from './dashboard';
import AdminLesions from './lesions';

export default function RouterAdmin() {
  return (
    <Route
      path="admin"
      element={<AdminLayout />}
    >
      <Route
        path="dashboard"
        element={<AdminDashboard />}
      />
      <Route
        path="users"
        element={<AdminUsers />}
      />
      <Route
        path="add-user"
        element={<AdminNewUser />}
      />
      <Route
        path="user/:userId"
        element={<AdminUser />}
      />
      <Route
        path="entities"
        element={<AdminEntites />}
      />
      <Route
        path="add-entity"
        element={<AdminNouvelleEntite />}
      />
      <Route
        path="entity/:entityId"
        element={<AdminEntity />}
      />
      <Route
        path="api-keys"
        element={<AdminApiKeys />}
      />
      <Route
        path="api-key-add"
        element={<AdminNewApiKey />}
      />
      <Route
        path="api-key/:apiKeyId"
        element={<AdminApiKey />}
      />
      <Route
        path="import-ccg"
        element={<CcgImport />}
      />
      <Route
        path="carcasses"
        element={<AdminCarcasses />}
      />
      <Route
        path="carcasse/:zacharie_carcasse_id"
        element={<AdminCarcasseDetail />}
      />
      <Route
        path="lesions"
        element={<AdminLesions />}
      />
    </Route>
  );
}
