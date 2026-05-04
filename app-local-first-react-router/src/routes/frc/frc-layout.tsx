import { Navigate, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { UserRoles } from '@prisma/client';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import Chargement from '@app/components/Chargement';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';

export default function FrcLayout() {
  const user = useMostFreshUser('FrcLayout');
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  const location = useLocation();
  const navigation: MainNavigationProps.Item[] = [
    {
      text: 'Tableau de bord',
      isActive:
        location.pathname === '/app/frc/tableau-de-bord' || location.pathname === '/app/frc',
      linkProps: { to: '/app/frc/tableau-de-bord', href: '#' },
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/frc/contact',
      linkProps: { to: '/app/frc/contact', href: '#' },
    },
  ];

  useEffect(() => {
    refreshUser('FrcLayout');
  }, []);

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.FRC)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="frc-layout"
        contactLink="/app/frc/contact"
        mainLink="/app/frc/tableau-de-bord"
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
