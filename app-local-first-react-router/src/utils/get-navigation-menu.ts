import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';

export function useLandingPageNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  return [
    {
      text: 'Accueil',
      isActive: location.pathname === '/',
      linkProps: {
        to: '/',
        href: '#',
      },
    },
    {
      text: 'Vos démarches',
      isActive: location.pathname === '/demarches',
      linkProps: {
        to: '/demarches',
        href: '#',
      },
    },
    {
      text: 'Professionnels de la filière',
      isActive: location.pathname === '/pros',
      linkProps: {
        to: '/pros',
        href: '#',
      },
    },
    {
      text: 'Aide',
      isActive: location.pathname === '/faq',
      linkProps: {
        to: '/faq',
        href: '#',
      },
    },
  ];
}
