import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';

export default function useCollecteurNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: 'Fiches',
      isActive: location.pathname.startsWith('/app/collecteur/fei') || location.pathname === '/app/collecteur',
      linkProps: { to: '/app/collecteur', href: '#' },
    },
    {
      text: 'Carcasses',
      isActive: location.pathname === '/app/collecteur/carcasses',
      linkProps: { to: '/app/collecteur/carcasses', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive:
        location.pathname.startsWith('/app/collecteur/profil') ||
        location.pathname.startsWith('/app/collecteur/entreprise'),
      menuLinks: [
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/collecteur/profil/coordonnees',
          linkProps: {
            href: '#',
            to: '/app/collecteur/profil/coordonnees',
          },
        },
        {
          text: 'Notifications',
          isActive: location.pathname === '/app/collecteur/profil/notifications',
          linkProps: {
            to: '/app/collecteur/profil/notifications',
            href: '#',
          },
        },
        {
          text: 'Partage de données',
          isActive: location.pathname === '/app/collecteur/profil/partage-de-mes-donnees',
          linkProps: {
            to: '/app/collecteur/profil/partage-de-mes-donnees',
            href: '#',
          },
        },
        {
          text: 'Entreprise',
          isActive: location.pathname === '/app/collecteur/entreprise/informations',
          linkProps: { to: '/app/collecteur/entreprise/informations', href: '#' },
        },
        {
          text: "Utilisateurs de l'entreprise",
          isActive: location.pathname === '/app/collecteur/entreprise/utilisateurs',
          linkProps: { to: '/app/collecteur/entreprise/utilisateurs', href: '#' },
        },
      ].filter((link) => {
        if (link.text !== 'Partage de mes données') return true;
        return !!apiKeyApprovals?.length;
      }),
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/collecteur/contact',
      linkProps: {
        to: '/app/collecteur/contact',
        href: '#',
      },
    },
  ];

  return navigationBase;
}
