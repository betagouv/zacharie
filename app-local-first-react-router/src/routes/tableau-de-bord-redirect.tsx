import { Navigate, Route, useLocation, useParams } from 'react-router';
import { User, UserRoles } from '@prisma/client';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { isCircuitCourt } from '@app/utils/circuit-court';
import Chargement from '@app/components/Chargement';

function getRoleSpace(user: User): string | null {
  if (user.roles.includes(UserRoles.CHASSEUR)) return '/app/chasseur';
  if (user.roles.includes(UserRoles.ETG)) return '/app/etg';
  if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) return '/app/collecteur';
  if (user.roles.includes(UserRoles.SVI)) return '/app/svi';
  if (isCircuitCourt(user)) return '/app/circuit-court';
  return null;
}

function useRedirectTarget(buildPath: (space: string) => string): string {
  const user = useMostFreshUser('TableauDeBordRedirect');
  const location = useLocation();
  if (!user) {
    const currentPath = location.pathname + location.search;
    return `/app/connexion?redirect=${encodeURIComponent(currentPath)}`;
  }
  const space = getRoleSpace(user);
  if (!space) return '/app/404';
  return buildPath(space);
}

function TableauDeBordRootRedirect() {
  const user = useMostFreshUser('TableauDeBordRootRedirect');
  const location = useLocation();
  if (!user) {
    return <Chargement />;
  }
  const space = getRoleSpace(user);
  if (!space) return <Navigate to="/app/404" replace />;
  return <Navigate to={`${space}${location.search}`} replace />;
}

function TableauDeBordFeiRedirect() {
  const { fei_numero } = useParams();
  const target = useRedirectTarget((space) => `${space}/fei/${fei_numero}`);
  return <Navigate to={target} replace />;
}

function TableauDeBordProfilCoordonneesRedirect() {
  const location = useLocation();
  const target = useRedirectTarget((space) => `${space}/profil/coordonnees${location.search}`);
  return <Navigate to={target} replace />;
}

export default function RouterTableauDeBordRedirect() {
  return (
    <Route path="tableau-de-bord">
      <Route
        index
        element={<TableauDeBordRootRedirect />}
      />
      <Route
        path="fei/:fei_numero"
        element={<TableauDeBordFeiRedirect />}
      />
      <Route
        path="profil/mes-coordonnees"
        element={<TableauDeBordProfilCoordonneesRedirect />}
      />
    </Route>
  );
}
