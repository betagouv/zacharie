import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';

export default function useChasseurNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);
  const user = useMostFreshUser('useChasseurNavigationMenu');

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: 'Tableau de bord',
      isActive: location.pathname === '/app/chasseur/tableau-de-bord',
      linkProps: { to: '/app/chasseur/tableau-de-bord', href: '#' },
    },
    {
      text: 'Fiches',
      isActive: location.pathname.startsWith('/app/chasseur/fei') || location.pathname === '/app/chasseur',
      linkProps: { to: '/app/chasseur', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive: location.pathname.startsWith('/app/chasseur/profil'),
      menuLinks: [
        {
          text: 'Informations de chasse',
          isActive:
            location.pathname === '/app/chasseur/profil/informations-de-chasse' ||
            location.pathname === '/app/chasseur/profil/associations-de-chasse' ||
            location.pathname === '/app/chasseur/profil/ccgs',
          linkProps: {
            href: '#',
            to: '/app/chasseur/profil/informations-de-chasse',
          },
        },
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/chasseur/profil/coordonnees',
          linkProps: {
            href: '#',
            to: '/app/chasseur/profil/coordonnees',
          },
        },
        {
          text: 'Notifications',
          isActive: location.pathname === '/app/chasseur/profil/notifications',
          linkProps: {
            href: '#',
            to: '/app/chasseur/profil/notifications',
          },
        },
        {
          text: 'Partage de données',
          isActive: location.pathname === '/app/chasseur/profil/partage-de-mes-donnees',
          linkProps: {
            href: '#',
            to: '/app/chasseur/profil/partage-de-mes-donnees',
          },
        },
      ].filter((link) => {
        if (link.text !== 'Partage de mes données') return true;
        return !!apiKeyApprovals?.length;
      }),
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/chasseur/contact',
      linkProps: {
        to: '/app/chasseur/contact',
        href: '#',
      },
    },
  ];

  if (user?.isZacharieAdmin) {
    navigationBase.push({
      text: 'Admin',
      isActive: location.pathname.startsWith('/app/admin'),
      linkProps: { to: '/app/admin/users', href: '#' },
    });
  }

  return navigationBase;
}
