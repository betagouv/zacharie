import { Outlet } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { useEffect } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function TableauDeBordLayout() {
  const user = useMostFreshUser('TableauDeBordLayout');
  const navigation = useLoggedInNavigationMenu();
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const isOnline = useIsOnline();
  useEffect(() => {
    refreshUser('TableauDeBordLayout');
  }, []);

  if (!user) {
    return <Chargement />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="tableau-de-bord-layout-activated"
        contactLink="/app/tableau-de-bord/contact"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative min-h-full overflow-auto"
        >
          <Outlet />
        </main>
      </RootDisplay>
      {import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-0 left-0 z-50 bg-white px-4 py-1 text-sm">
          {dataIsSynced ? 'Synchronisation en cours' : isOnline ? 'En ligne' : 'Hors ligne'}
        </p>
      )}
    </>
  );
}
