import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';

export default function useSviNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: 'Fiches',
      isActive: location.pathname.startsWith('/app/svi/fei') || location.pathname === '/app/svi',
      linkProps: { to: '/app/svi', href: '#' },
    },
    {
      text: 'Carcasses',
      isActive: location.pathname === '/app/svi/carcasses',
      linkProps: { to: '/app/svi/carcasses', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive: location.pathname.startsWith('/app/svi/profil') || location.pathname.startsWith('/app/svi/entreprise'),
      menuLinks: [
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/svi/profil/coordonnees',
          linkProps: {
            href: '#',
            to: '/app/svi/profil/coordonnees',
          },
        },
        {
          text: 'Notifications',
          isActive: location.pathname === '/app/svi/profil/notifications',
          linkProps: {
            to: '/app/svi/profil/notifications',
            href: '#',
          },
        },
        {
          text: 'Partage de données',
          isActive: location.pathname === '/app/svi/profil/partage-de-mes-donnees',
          linkProps: {
            to: '/app/svi/profil/partage-de-mes-donnees',
            href: '#',
          },
        },
        {
          text: 'Mon service',
          isActive: location.pathname === '/app/svi/entreprise/informations',
          linkProps: { to: '/app/svi/entreprise/informations', href: '#' },
        },
        {
          text: 'Utilisateurs du service',
          isActive: location.pathname === '/app/svi/entreprise/utilisateurs',
          linkProps: { to: '/app/svi/entreprise/utilisateurs', href: '#' },
        },
      ].filter((link) => {
        if (link.text !== 'Partage de mes données') return true;
        return !!apiKeyApprovals?.length;
      }),
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/svi/contact',
      linkProps: {
        to: '/app/svi/contact',
        href: '#',
      },
    },
  ];

  return navigationBase;
}
