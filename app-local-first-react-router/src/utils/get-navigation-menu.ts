import { UserRoles } from '@prisma/client';
import { useLocation, useNavigate } from 'react-router';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { clearCache } from '@app/services/indexed-db';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { createNewFei } from './create-new-fei';

export default function useNavigationMenu() {
  const location = useLocation();
  const user = useMostFreshUser('useNavigationMenu');
  const isNotActivated = !user?.activated;

  const navigate = useNavigate();

  const isOnline = useIsOnline();

  const handleLogout = async () => {
    fetch(`${import.meta.env.VITE_API_URL}/user/logout`, {
      method: 'POST',
      credentials: 'include',
    }).then(async (res) => {
      if (res.ok) {
        await clearCache().then(() => {
          window.location.href = '/app/connexion?type=compte-existant';
        });
      }
    });
  };

  const isExaminateurInitial = user?.roles.includes(UserRoles.EXAMINATEUR_INITIAL);
  const isOnlyExaminateurInitial = isExaminateurInitial && user?.roles.length === 1;
  const isAdmin = user?.roles.includes(UserRoles.ADMIN);
  const isSvi = user?.roles.includes(UserRoles.SVI);

  const profileMenu: MainNavigationProps.Item[] = [
    {
      text: 'Mes roles',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mes-roles',
      linkProps: {
        to: '/app/tableau-de-bord/mon-profil/mes-roles',
        href: '#',
      },
    },
    {
      text: 'Mes informations',
      isActive: location.pathname === '/app/tableau-de-bord/mon-profil/mes-informations',
      linkProps: {
        href: '#',
        to: '/app/tableau-de-bord/mon-profil/mes-informations',
      },
    },
  ];

  if (!isOnlyExaminateurInitial) {
    profileMenu.push({
      text: 'Mes CCGs',
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
  profileMenu.push({
    text: `Déconnecter ${user?.email}`,
    linkProps: {
      onClick: handleLogout,
      type: 'submit',
      href: '#',
    },
  });

  const feiMenu: MainNavigationProps.Item[] = isNotActivated
    ? []
    : [
        {
          text: isSvi ? 'Fiches' : 'Mes fiches',
          isActive: location.pathname === '/app/tableau-de-bord',
          linkProps: { to: '/app/tableau-de-bord', href: '#' },
        },
      ];

  if (isExaminateurInitial && !isNotActivated) {
    feiMenu.unshift({
      text: 'Nouvelle fiche',
      linkProps: {
        href: '#',
        onClick: () => {
          const newFei = createNewFei();
          navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
        },
      },
    });
  }

  if (isSvi) {
    feiMenu.push({
      text: 'Carcasses',
      isActive: location.pathname === '/app/tableau-de-bord/registre-carcasses',
      linkProps: { to: '/app/tableau-de-bord/registre-carcasses', href: '#' },
    });
  }

  const navigationBase: MainNavigationProps.Item[] = [
    // @ts-expect-error problem with MainNavigationProps.Item[]
    ...feiMenu,
    {
      text: 'Mon profil',
      isActive: location.pathname.startsWith('/app/tableau-de-bord/mon-profil'),
      // @ts-expect-error problem with MainNavigationProps.Item[]
      menuLinks: profileMenu,
    },
    // @ts-expect-error problem with MainNavigationProps.Item[]
    {
      text: "Obtenir la dernière version de l'app",
      linkProps: {
        href: '#',
        onClick: () => {
          if (isOnline) {
            clearCache().then(() => window.location.reload());
          } else {
            alert('Vous devez être connecté à internet pour effectuer cette action');
          }
        },
      },
    },
    // @ts-expect-error problem with MainNavigationProps.Item[]
    {
      text: 'Contactez-nous',
      linkProps: {
        href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de mon tableau de bord à Zacharie`,
      },
    },
  ];

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
          text: '+ Ajouter des utilisateurs',
          isActive: location.pathname === '/app/tableau-de-bord/admin/add-user',
          linkProps: {
            href: '#',
            to: '/app/tableau-de-bord/admin/add-user',
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
          text: '+ Ajouter des entités (SVI, ETG, etc.)',
          isActive: location.pathname === '/app/tableau-de-bord/admin/add-entity',
          linkProps: {
            href: '#',
            to: '/app/tableau-de-bord/admin/add-entity',
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
      ],
    });
  }

  return navigationBase;
}
