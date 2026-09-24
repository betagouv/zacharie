import { Navigate, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { UserRoles } from '@prisma/client';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import RootDisplay from '@app/components/RootDisplay';
import BottomNavigation from '@app/components/BottomNavigation';
import Chargement from '@app/components/Chargement';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';

export default function FederationLayout() {
  const user = useMostFreshUser('FederationLayout');
  const _hasHydrated = useZustandStore((state) => state._hasHydrated);
  const location = useLocation();
  const navigation: MainNavigationProps.Item[] = [
    {
      text: 'Tableau de bord',
      isActive: location.pathname === '/app/federation/tableau-de-bord',
      linkProps: { to: '/app/federation/tableau-de-bord', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive: location.pathname.startsWith('/app/federation/profil'),
      menuLinks: [
        {
          text: 'Ma fédération',
          isActive: location.pathname === '/app/federation/profil/ma-federation',
          linkProps: { to: '/app/federation/profil/ma-federation', href: '#' },
        },
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/federation/profil/coordonnees',
          linkProps: { to: '/app/federation/profil/coordonnees', href: '#' },
        },
        {
          text: 'Changer de mot de passe',
          isActive: location.pathname === '/app/federation/profil/mot-de-passe',
          linkProps: { to: '/app/federation/profil/mot-de-passe', href: '#' },
        },
      ],
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/federation/contact',
      linkProps: { to: '/app/federation/contact', href: '#' },
    },
  ];

  useEffect(() => {
    refreshUser('FederationLayout');
  }, []);

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/app/connexion?redirect=${encodeURIComponent(currentPath)}`} />;
  }

  if (!user.roles.includes(UserRoles.FEDERATION)) {
    return <Navigate to="/app/connexion" />;
  }

  if (!user.onboarded_at && location.pathname !== '/app/federation/onboarding/coordonnees') {
    return <Navigate to="/app/federation/onboarding/coordonnees" />;
  }

  return (
    <>
      <RootDisplay
        navigation={user.onboarded_at ? navigation : []}
        hideMinistereName
        id="federation-layout"
        contactLink="/app/federation/contact"
        mainLink="/app/federation/tableau-de-bord"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative flex min-h-full flex-col overflow-visible pb-16 md:pb-0"
        >
          {!_hasHydrated ? <Chargement /> : <Outlet />}
        </main>
      </RootDisplay>
      {!!user.onboarded_at && <BottomNavigation items={navigation} />}
    </>
  );
}
