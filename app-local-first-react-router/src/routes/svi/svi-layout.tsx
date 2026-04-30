import { Navigate, Outlet, useLocation } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useZustandStore from '@app/zustand/store';
import useSviNavigationMenu from './svi-navigation-menu';
import BottomNavigation from '@app/components/BottomNavigation';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { UserRoles } from '@prisma/client';
import Chargement from '@app/components/Chargement';

export default function SviLayout() {
  const sviNavigation = useSviNavigationMenu();
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const user = useMostFreshUser('SviLayout');
  const isOnline = useIsOnline();
  const location = useLocation();
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);


  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user?.roles.includes(UserRoles.SVI)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <>
      <RootDisplay
        navigation={sviNavigation}
        hideMinistereName
        id="svi-layout-activated"
        contactLink="/app/svi/contact"
        mainLink="/app/svi"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative flex min-h-full flex-col overflow-visible pb-16 md:pb-0"
        >
          {!_hasHydrated ? <Chargement /> : <Outlet />}
        </main>
      </RootDisplay>
      <BottomNavigation items={sviNavigation} />
      {import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-16 left-0 z-50 bg-white px-4 py-1 text-sm md:bottom-0">
          {!dataIsSynced ? 'Synchronisation en cours' : isOnline ? 'En ligne' : 'Hors ligne'}
        </p>
      )}
    </>
  );
}
