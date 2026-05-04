import { Navigate, Outlet, useLocation } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { useEffect } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { UserRoles } from '@prisma/client';

export default function TableauDeBordLayout({ navigation }: { navigation: MainNavigationProps.Item[] }) {
  const user = useMostFreshUser('TableauDeBordLayout');
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const isOnline = useIsOnline();
  const location = useLocation();

  useEffect(() => {
    refreshUser('TableauDeBordLayout');
  }, []);

  if (!user) {
    return <Chargement />;
  }

  if (user.roles.includes(UserRoles.CHASSEUR)) {
    const newPathName = location.pathname.replace('/app/tableau-de-bord', '/app/chasseur');
    return <Navigate to={newPathName} />;
  }

  if (user.roles.includes(UserRoles.SVI)) {
    const newPathName = location.pathname.replace('/app/tableau-de-bord', '/app/svi');
    return <Navigate to={newPathName} />;
  }

  if (user.roles.includes(UserRoles.FDC)) {
    const newPathName = location.pathname.replace('/app/tableau-de-bord', '/app/fdc');
    return <Navigate to={newPathName} />;
  }

  if (user.roles.includes(UserRoles.FRC)) {
    const newPathName = location.pathname.replace('/app/tableau-de-bord', '/app/frc');
    return <Navigate to={newPathName} />;
  }

  if (user.roles.includes(UserRoles.FNC)) {
    const newPathName = location.pathname.replace('/app/tableau-de-bord', '/app/fnc');
    return <Navigate to={newPathName} />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="tableau-de-bord-layout-activated"
        contactLink="/app/contact"
        mainLink="/app/tableau-de-bord"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative flex min-h-full flex-col overflow-visible pb-16 md:pb-0"
        >
          <Outlet />
        </main>
      </RootDisplay>
      <BottomNavigation items={navigation} />
      {import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-16 left-0 z-50 bg-white px-4 py-1 text-sm md:bottom-0">
          {!dataIsSynced ? 'Synchronisation en cours' : isOnline ? 'En ligne' : 'Hors ligne'}
        </p>
      )}
    </>
  );
}
