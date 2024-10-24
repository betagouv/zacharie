import { UserRoles } from "@prisma/client";
import { useLocation } from "@remix-run/react";
import { type MainNavigationProps } from "@codegouvfr/react-dsfr/MainNavigation";
import { useUser } from "./useUser";
import { clearCache } from "@app/services/indexed-db.client";
import { useIsOnline } from "@app/components/OfflineMode";

export default function useNavigationMenu() {
  const location = useLocation();
  const user = useUser();
  const isOnline = useIsOnline();

  const handleLogout = async () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/action/user/logout`, {
      method: "POST",
      credentials: "include",
    }).then(async (res) => {
      if (res.ok) {
        await clearCache().then(() => {
          window.location.href = "/app/connexion?type=compte-existant";
        });
      }
    });
  };

  const isExaminateurInitial = user!.roles.includes(UserRoles.EXAMINATEUR_INITIAL);
  const isOnlyExaminateurInitial = isExaminateurInitial && user!.roles.length === 1;
  const isAdmin = user!.roles.includes(UserRoles.ADMIN);

  const profileMenu = [
    {
      text: "Mes roles",
      isActive: location.pathname === "/app/tableau-de-bord/mon-profil/mes-roles",
      linkProps: {
        to: "/app/tableau-de-bord/mon-profil/mes-roles",
        href: "#",
      },
    },
    {
      text: "Mes informations",
      isActive: location.pathname === "/app/tableau-de-bord/mon-profil/mes-informations",
      linkProps: {
        href: "#",
        to: "/app/tableau-de-bord/mon-profil/mes-informations",
      },
    },
  ];

  if (!isOnlyExaminateurInitial) {
    profileMenu.push({
      text: "Mes CCGs",
      isActive: location.pathname === "/app/tableau-de-bord/mon-profil/mes-ccgs",
      linkProps: {
        href: "#",
        to: "/app/tableau-de-bord/mon-profil/mes-ccgs",
      },
    });
  }
  profileMenu.push({
    text: "Mes notifications",
    isActive: location.pathname === "/app/tableau-de-bord/mon-profil/mes-notifications",
    linkProps: {
      href: "#",
      to: "/app/tableau-de-bord/mon-profil/mes-notifications",
    },
  });

  const feiMenu = [
    {
      text: "Mes fiches",
      isActive: location.pathname === "/app/tableau-de-bord",
      linkProps: { to: "/app/tableau-de-bord", href: "#" },
    },
  ];
  if (isExaminateurInitial) {
    feiMenu.push({
      text: "Nouvelle fiche",
      isActive: location.pathname === "/app/tableau-de-bord/fei/nouvelle",
      linkProps: {
        to: "/app/tableau-de-bord/fei/nouvelle",
        href: "#",
      },
    });
  }

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: "Mon profil",
      isActive: location.pathname.startsWith("/app/tableau-de-bord/mon-profil"),
      menuLinks: profileMenu,
    },
    ...feiMenu,
    {
      text: `Déconnecter ${user?.email}`,
      linkProps: {
        onClick: handleLogout,
        type: "submit",
        href: "#",
      },
    },
    {
      text: "Contactez-nous",
      linkProps: {
        href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de mon tableau de bord à Zacharie`,
      },
    },
  ];

  if (isAdmin) {
    navigationBase.push({
      text: "Admin",
      isActive: location.pathname.startsWith("/app/tableau-de-bord/admin"),
      menuLinks: [
        {
          text: "Liste des utilisateurs",
          isActive: location.pathname === "/app/tableau-de-bord/admin/utilisateurs",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/utilisateurs",
          },
        },
        {
          text: "+ Ajouter des utilisateurs",
          isActive: location.pathname === "/app/tableau-de-bord/admin/ajouter-utilisateur",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/utilisateur/nouveau",
          },
        },
        {
          text: "Liste des entités",
          isActive: location.pathname === "/app/tableau-de-bord/admin/entites",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/entites",
          },
        },
        {
          text: "+ Ajouter des entités (SVI, ETG, etc.)",
          isActive: location.pathname === "/app/tableau-de-bord/admin/ajouter-entite",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/entite/nouvelle",
          },
        },
        {
          text: "Liste des fiches",
          isActive: location.pathname === "/app/tableau-de-bord/admin/feis",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/feis",
          },
        },
      ],
    });
  }

  navigationBase.push({
    text: "Obtenir la dernière version de l'app",
    linkProps: {
      href: "#",
      onClick: () => {
        if (isOnline) {
          clearCache().then(() => window.location.reload());
        } else {
          alert("Vous devez être connecté à internet pour effectuer cette action");
        }
      },
    },
  });

  return navigationBase;
}
