import { Navigate, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { UserRoles } from '@prisma/client';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import Chargement from '@app/components/Chargement';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';

/**
 * Espace laboratoire (LVD et LNR, rôle LABORATOIRE — cf doc/trichine.md §6.3-6.4).
 * Le LNR voit les mêmes écrans : le backend filtre les FTP par entité destinataire.
 */
export default function LaboratoireLayout() {
  const user = useMostFreshUser('LaboratoireLayout');
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  const location = useLocation();
  const navigation: MainNavigationProps.Item[] = [
    {
      text: 'FTP reçues',
      isActive:
        location.pathname.startsWith('/app/laboratoire/ftp') || location.pathname === '/app/laboratoire',
      linkProps: { to: '/app/laboratoire/ftp', href: '#' },
    },
    {
      text: 'Mon laboratoire',
      isActive: location.pathname.startsWith('/app/laboratoire/profil'),
      linkProps: { to: '/app/laboratoire/profil', href: '#' },
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/laboratoire/contact',
      linkProps: { to: '/app/laboratoire/contact', href: '#' },
    },
  ];

  useEffect(() => {
    refreshUser('LaboratoireLayout');
  }, []);

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.LABORATOIRE)) {
    return <Navigate to="/app/connexion" />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="laboratoire-layout"
        contactLink="/app/laboratoire/contact"
        mainLink="/app/laboratoire/ftp"
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
