import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useCallback, useEffect, useMemo } from 'react';
import useZustandStore from '@app/zustand/store';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import FloatingNewFicheButton from '@app/components/FloatingNewFicheButton';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { createNewFei } from '@app/utils/create-new-fei';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import useChasseurNavigationMenu from './chasseur-navigation-menu';
import { UserRoles } from '@prisma/client';
import { hasAllRequiredFields } from '@app/utils/user';
import ChasseurDeactivated from './chasseur-deactivated';
import Chargement from '@app/components/Chargement';

export default function ChasseurLayout() {
  const user = useMostFreshUser('ChasseurLayout');
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const isOnline = useIsOnline();
  const navigate = useNavigate();
  const navigation = useChasseurNavigationMenu();
  const location = useLocation();
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);

  const showDeactivatedAccount = useMemo(() => {
    const isRestrictedPage =
      !location.pathname.includes('profil') && !location.pathname.includes('onboarding') && !location.pathname.includes('admin');
    if (!isRestrictedPage) return false;
    if (!user) return false;
    const needToCompleteExaminateurInitial = user?.roles.includes(UserRoles.CHASSEUR) && user?.est_forme_a_l_examen_initial == null;
    const isProfileCompleted = hasAllRequiredFields(user!) && !needToCompleteExaminateurInitial;
    return !isProfileCompleted;
  }, [user, location.pathname]);

  const onNewFiche = useCallback(async () => {
    const newFei = await createNewFei();
    navigate(`/app/chasseur/fei/${newFei.numero}`);
  }, [navigate]);

  useEffect(() => {
    refreshUser('ChasseurLayout');
  }, []);

  if (!user) {
    const currentPath = location.pathname + location.search;
    console.log('NO CHASSEUR USER');
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.CHASSEUR)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="chasseur-layout-activated"
        contactLink="/app/chasseur/contact"
        mainLink="/app/chasseur"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative flex min-h-full flex-col overflow-visible pb-16 md:pb-0"
        >
          {!_hasHydrated ? <Chargement /> : showDeactivatedAccount ? <ChasseurDeactivated /> : <Outlet />}
        </main>
      </RootDisplay>
      <FloatingNewFicheButton />
      <BottomNavigation
        items={navigation}
        onNewFiche={onNewFiche}
      />
      {import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-16 left-0 z-50 bg-white px-4 py-1 text-sm md:bottom-0">
          {!dataIsSynced ? 'Synchronisation en cours' : isOnline ? 'En ligne' : 'Hors ligne'}
        </p>
      )}
    </>
  );
}
