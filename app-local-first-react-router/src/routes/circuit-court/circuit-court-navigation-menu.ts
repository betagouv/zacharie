import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';

export default function useCircuitCourtNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: 'Fiches',
      isActive: location.pathname.startsWith('/app/circuit-court/fei') || location.pathname === '/app/circuit-court',
      linkProps: { to: '/app/circuit-court', href: '#' },
    },
    {
      text: 'Paramètres',
      isActive: location.pathname.startsWith('/app/circuit-court/profil') || location.pathname.startsWith('/app/circuit-court/entreprise'),
      menuLinks: [
        {
          text: 'Coordonnées',
          isActive: location.pathname === '/app/circuit-court/profil/coordonnees',
          linkProps: {
            href: '#',
            to: '/app/circuit-court/profil/coordonnees',
          },
        },
        {
          text: 'Notifications',
          isActive: location.pathname === '/app/circuit-court/profil/notifications',
          linkProps: {
            to: '/app/circuit-court/profil/notifications',
            href: '#',
          },
        },
        {
          text: 'Entreprise',
          isActive: location.pathname === '/app/circuit-court/entreprise/informations',
          linkProps: { to: '/app/circuit-court/entreprise/informations', href: '#' },
        },
        {
          text: "Utilisateurs de l'entreprise",
          isActive: location.pathname === '/app/circuit-court/entreprise/utilisateurs',
          linkProps: { to: '/app/circuit-court/entreprise/utilisateurs', href: '#' },
        },
      ],
    },
    {
      text: 'Contact',
      isActive: location.pathname === '/app/circuit-court/contact',
      linkProps: {
        to: '/app/circuit-court/contact',
        href: '#',
      },
    },
  ];

  return navigationBase;
}
