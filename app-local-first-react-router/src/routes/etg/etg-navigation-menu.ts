import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';

export default function useEtgNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: 'Fiches',
      isActive: location.pathname.startsWith('/app/etg/fei') || location.pathname === '/app/etg',
      linkProps: { to: '/app/etg', href: '#' },
    },
    {
      text: 'Carcasses',
      isActive: location.pathname === '/app/etg/carcasses',
      linkProps: { to: '/app/etg/carcasses', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive:
        location.pathname.startsWith('/app/etg/profil') ||
        location.pathname.startsWith('/app/etg/entreprise'),
      menuLinks: [
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/etg/profil/coordonnees',
          linkProps: {
            href: '#',
            to: '/app/etg/profil/coordonnees',
          },
        },
        {
          text: 'Notifications',
          isActive: location.pathname === '/app/etg/profil/notifications',
          linkProps: {
            to: '/app/etg/profil/notifications',
            href: '#',
          },
        },
        {
          text: 'Partage de données',
          isActive: location.pathname === '/app/etg/profil/partage-de-mes-donnees',
          linkProps: {
            to: '/app/etg/profil/partage-de-mes-donnees',
            href: '#',
          },
        },
        {
          text: 'Entreprise',
          isActive: location.pathname === '/app/etg/entreprise/informations',
          linkProps: { to: '/app/etg/entreprise/informations', href: '#' },
        },
        {
          text: "Utilisateurs de l'entreprise",
          isActive: location.pathname === '/app/etg/entreprise/utilisateurs',
          linkProps: { to: '/app/etg/entreprise/utilisateurs', href: '#' },
        },
      ].filter((link) => {
        if (link.text !== 'Partage de mes données') return true;
        return !!apiKeyApprovals?.length;
      }),
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/etg/contact',
      linkProps: {
        to: '/app/etg/contact',
        href: '#',
      },
    },
  ];

  return navigationBase;
}
