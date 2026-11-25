import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';

export default function useSviNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);

  const navigationBase: MainNavigationProps.Item[] = [
    //   {
    //     text: 'Tableau de bord',
    //     isActive: location.pathname === '/app/svi/tableau-de-bord',
    //     linkProps: { to: '/app/svi/tableau-de-bord', href: '#' },
    //   },
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
    // Invisible en production tant que le feature flag trichine n'est pas activé
    ...(TRICHINE_FEATURE_ENABLED
      ? [
          {
            text: 'Trichine',
            isActive: location.pathname.startsWith('/app/svi/trichine'),
            linkProps: { to: '/app/svi/trichine', href: '#' },
          },
        ]
      : []),
    {
      text: 'Paramètres',
      isActive:
        location.pathname.startsWith('/app/svi/profil') ||
        location.pathname.startsWith('/app/svi/entreprise'),
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
          text: 'Changer de mot de passe',
          isActive: location.pathname === '/app/svi/profil/mot-de-passe',
          linkProps: {
            href: '#',
            to: '/app/svi/profil/mot-de-passe',
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
        if (link.text !== 'Partage de données') return true;
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
