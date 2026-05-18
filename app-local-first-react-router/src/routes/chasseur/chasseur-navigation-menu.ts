import { useLocation } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { CarcasseModificationRequestStatus } from '@prisma/client';

export default function useChasseurNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);
  const user = useUser((state) => state.user);
  const modifRequests = useZustandStore((state) => state.carcasseModifRequestsById);
  const carcasses = useZustandStore((state) => state.carcasses);

  const pendingForMeCount = Object.values(modifRequests).filter((r) => {
    if (r.status !== CarcasseModificationRequestStatus.PENDING || r.deleted_at) return false;
    const c = carcasses[r.zacharie_carcasse_id];
    return c?.examinateur_initial_user_id === user?.id;
  }).length;

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
      text: pendingForMeCount > 0 ? `Demandes de modification (${pendingForMeCount})` : 'Demandes de modification',
      isActive: location.pathname.startsWith('/app/chasseur/demandes-de-modification'),
      linkProps: { to: '/app/chasseur/demandes-de-modification', href: '#' },
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
        if (link.text !== 'Partage de données') return true;
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

  return navigationBase;
}
