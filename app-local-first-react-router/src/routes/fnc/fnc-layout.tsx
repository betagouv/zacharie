import { Navigate, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { UserRoles } from '@prisma/client';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import Chargement from '@app/components/Chargement';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import useFederationNavigationMenu from '../federation/federation-navigation-menu';

export default function FncLayout() {
  const user = useMostFreshUser('FncLayout');
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  const navigation = useFederationNavigationMenu('fnc');
  const location = useLocation();

  useEffect(() => {
    refreshUser('FncLayout');
  }, []);

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.FNC)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="fnc-layout"
        contactLink="/app/fnc/contact"
        mainLink="/app/fnc/tableau-de-bord"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative flex min-h-full flex-col overflow-visible pb-16 md:pb-0"
        >
          {!_hasHydrated ? <Chargement /> : <Outlet />}
        </main>
      </RootDisplay>
      <BottomNavigation items={navigation} />
    </>
  );
}
