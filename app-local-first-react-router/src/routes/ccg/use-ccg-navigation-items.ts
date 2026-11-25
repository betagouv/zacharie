import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useZustandStore from '@app/zustand/store';

// Onglet « Mes CCG » : seulement pour le propriétaire d'au moins un CCG, quel que soit son rôle.
export default function useCcgNavigationItems(basePath: string): MainNavigationProps.Item[] {
  const location = useLocation();
  const ccgEntityIds = useZustandStore((state) => state.ccgEntityIds);
  if (!ccgEntityIds.length) return [];
  return [
    {
      text: 'Mes CCG',
      isActive: location.pathname.startsWith(`${basePath}/ccg`),
      linkProps: { to: `${basePath}/ccg`, href: '#' },
    },
  ];
}
