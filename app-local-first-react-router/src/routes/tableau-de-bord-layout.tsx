import { Outlet, useNavigate } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import FloatingNewFicheButton from '@app/components/FloatingNewFicheButton';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { createNewFei } from '@app/utils/create-new-fei';
import Chargement from '@app/components/Chargement';
import { useCallback, useEffect } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { UserRoles } from '@prisma/client';

export default function TableauDeBordLayout() {
  const user = useMostFreshUser('TableauDeBordLayout');
  const navigation = useLoggedInNavigationMenu();
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const isOnline = useIsOnline();
  const navigate = useNavigate();

  const isExaminateurInitial =
    user?.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei && !!user.activated;

  const onNewFiche = useCallback(async () => {
    const newFei = await createNewFei();
    navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
  }, [navigate]);

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
          className="fr-background-alt--blue-france relative min-h-full overflow-auto pb-16 md:pb-0"
        >
          <Outlet />
        </main>
      </RootDisplay>
      <FloatingNewFicheButton />
      <BottomNavigation items={navigation} onNewFiche={isExaminateurInitial ? onNewFiche : undefined} />
      {import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-16 left-0 z-50 bg-white px-4 py-1 text-sm md:bottom-0">
          {!dataIsSynced ? 'Synchronisation en cours' : isOnline ? 'En ligne' : 'Hors ligne'}
        </p>
      )}
    </>
  );
}
