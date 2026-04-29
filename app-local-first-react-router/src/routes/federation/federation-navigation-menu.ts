import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';

type FederationKind = 'fdc' | 'frc' | 'fnc';

export default function useFederationNavigationMenu(kind: FederationKind): MainNavigationProps.Item[] {
  const location = useLocation();
  const base = `/app/${kind}`;
  return [
    {
      text: 'Tableau de bord',
      isActive: location.pathname === `${base}/tableau-de-bord` || location.pathname === base,
      linkProps: { to: `${base}/tableau-de-bord`, href: '#' },
    },
    {
      text: 'Contact',
      isActive: location.pathname === `${base}/contact`,
      linkProps: { to: `${base}/contact`, href: '#' },
    },
  ];
}
