import { UserRoles } from '@prisma/client';
import { useLocation, useNavigate } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { createNewFei } from './create-new-fei';
import useZustandStore from '@app/zustand/store';
import { useIsCircuitCourt } from './circuit-court';
import { capture } from '@app/services/sentry';

export default function useLoggedInNavigationMenu(): MainNavigationProps.Item[] {
  const location = useLocation();
  const user = useMostFreshUser('useLoggedInNavigationMenu');
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);
  const isNotActivated = !user?.activated;
  const isCircuitCourt = useIsCircuitCourt();
  const navigate = useNavigate();

  const isExaminateurInitial = user?.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
  const isAdmin = user?.roles.includes(UserRoles.ADMIN);
  const isChasseur = user?.roles.includes(UserRoles.CHASSEUR);
  const isSvi = user?.roles.includes(UserRoles.SVI);
  const isEtg = user?.roles.includes(UserRoles.ETG);
  const isCollecteurPro = user?.roles.includes(UserRoles.COLLECTEUR_PRO);
  const profileMenu: MainNavigationProps.Item[] = [];

  if (user?.roles.includes(UserRoles.CHASSEUR)) {
    profileMenu.push({
      text: 'Mes informations de chasse',
      isActive:
        location.pathname === '/app/tableau-de-bord/mon-profil/mes-informations-de-chasse' ||
        location.pathname === '/app/tableau-de-bord/mon-profil/mes-associations-de-chasse' ||
        location.pathname === '/app/tableau-de-bord/mon-profil/mes-ccgs',
      linkProps: {
        href: '#',
        to: '/app/tableau-de-bord/mon-profil/mes-informations-de-chasse',
      },
    });
  }

  profileMenu.push(
    {
      text: 'Mes coordonnées',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mes-coordonnees',
      linkProps: {
        href: '#',
        to: '/app/tableau-de-bord/mon-profil/mes-coordonnees',
      },
    },
    {
      text: 'Mon activité',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mon-activite',
      linkProps: {
        to: '/app/tableau-de-bord/mon-profil/mon-activite',
        href: '#',
      },
    },
  );
  if (user?.roles.includes(UserRoles.COLLECTEUR_PRO)) {
    profileMenu.push({
      text: 'Mes centres de collecte',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mes-ccgs',
      linkProps: {
        href: '#',
        to: '/app/tableau-de-bord/mon-profil/mes-ccgs',
      },
    });
  }
  profileMenu.push({
    text: 'Mes notifications',
    isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mes-notifications',
    linkProps: {
      href: '#',
      to: '/app/tableau-de-bord/mon-profil/mes-notifications',
    },
  });
  if (apiKeyApprovals && apiKeyApprovals.length > 0) {
    profileMenu.push({
      text: 'Partage de mes données',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/partage-de-mes-donnees',
      linkProps: {
        href: '#',
        to: '/app/tableau-de-bord/mon-profil/partage-de-mes-donnees',
      },
    });
  }

  const mainMenu: MainNavigationProps.Item[] = [
    {
      text: 'Fiches',
      isActive:
        location.pathname.startsWith('/app/tableau-de-bord/fei') ||
        location.pathname === '/app/tableau-de-bord',
      linkProps: { to: '/app/tableau-de-bord', href: '#' },
    },
  ];

  if (isChasseur) {
    mainMenu.unshift({
      text: 'Tableau de bord',
      isActive: location.pathname === '/app/tableau-de-bord/mes-chasses',
      linkProps: { to: '/app/tableau-de-bord/mes-chasses', href: '#' },
    });
  }

  if (isExaminateurInitial && !isNotActivated) {
    mainMenu.unshift({
      text: 'Nouvelle fiche',
      linkProps: {
        href: '#',
        onClick: async () => {
          const newFei = await createNewFei();
          navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
        },
      },
    });
  }

  if (isSvi || isEtg || isCollecteurPro) {
    mainMenu.push({
      text: 'Carcasses',
      isActive: location.pathname === '/app/tableau-de-bord/registre-carcasses',
      linkProps: { to: '/app/tableau-de-bord/registre-carcasses', href: '#' },
    });
  }

  const navigationBase: MainNavigationProps.Item[] = [
    // @ts-expect-error problem with MainNavigationProps.Item[]
    ...mainMenu,
    {
      text: 'Mon profil',
      isActive: location.pathname.startsWith('/app/tableau-de-bord/mon-profil'),
      // @ts-expect-error problem with MainNavigationProps.Item[]
      menuLinks: profileMenu,
    },
  ];
  if (
    isCircuitCourt ||
    user?.roles.includes(UserRoles.SVI) ||
    user?.roles.includes(UserRoles.ETG) ||
    user?.roles.includes(UserRoles.COLLECTEUR_PRO)
  ) {
    navigationBase.push({
      text: user?.roles.includes(UserRoles.SVI) ? 'Mon service' : 'Mon entreprise',
      isActive: location.pathname.startsWith('/app/tableau-de-bord/mon-entreprise'),
      menuLinks: [
        {
          text: 'Informations',
          isActive: location.pathname === '/app/tableau-de-bord/mon-entreprise/informations',
          linkProps: { to: '/app/tableau-de-bord/mon-entreprise/informations', href: '#' },
        },
        {
          text: 'Ajouter un utilisateur',
          isActive: location.pathname === '/app/tableau-de-bord/mon-entreprise/utilisateurs',
          linkProps: { to: '/app/tableau-de-bord/mon-entreprise/utilisateurs', href: '#' },
        },
      ],
    });
  }

  if (isAdmin) {
    navigationBase.push({
      text: 'Admin',
      isActive: location.pathname.startsWith('/app/tableau-de-bord/admin'),
      menuLinks: [
        {
          text: 'Liste des utilisateurs',
          isActive: location.pathname === '/app/tableau-de-bord/admin/users',
          linkProps: {
            href: '#',
            to: '/app/tableau-de-bord/admin/users',
          },
        },
        {
          text: 'Liste des entités',
          isActive: location.pathname === '/app/tableau-de-bord/admin/entities',
          linkProps: {
            href: '#',
            to: '/app/tableau-de-bord/admin/entities',
          },
        },
        {
          text: 'Liste des clés API',
          isActive: location.pathname === '/app/tableau-de-bord/admin/api-keys',
          linkProps: {
            href: '#',
            to: '/app/tableau-de-bord/admin/api-keys',
          },
        },
        {
          text: 'Liste des fiches',
          isActive: location.pathname === '/app/tableau-de-bord/admin/feis',
          linkProps: {
            // href: '#',
            href: 'https://metabase.zacharie.beta.gouv.fr/question/27-fiches-creees',
          },
        },
        ...(user?.prenom?.includes('Arnaud') || user?.prenom?.includes('Tangi')
          ? [
              {
                text: 'Test Sentry',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    console.log('Test Sentry');
                    capture('Test Sentry works ok');
                  },
                },
              },
              {
                text: 'Test Crash for Sentry',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    // @ts-expect-error I need a real crash
                    user.error.includes('test');
                  },
                },
              },
            ]
          : []),
      ],
    });
  }

  navigationBase.push({
    text: 'Contact',
    isActive: location.pathname === '/app/tableau-de-bord/contact',
    linkProps: {
      to: '/app/tableau-de-bord/contact',
      href: '#',
    },
  });

  return navigationBase;
}

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
    // {
    //   text: 'Aide',
    //   isActive: location.pathname === '/aide',
    //   linkProps: {
    //     to: '/aide',
    //     href: '#',
    //   },
    // },
  ];
}
