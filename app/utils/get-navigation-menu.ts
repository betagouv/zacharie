import { UserRoles } from "@prisma/client";
import { useLocation } from "@remix-run/react";
import { type MainNavigationProps } from "@codegouvfr/react-dsfr/MainNavigation";
import { useUser } from "./useUser";
import { clearCache } from "~/services/indexed-db.client";
import { useLatestVersion } from "./useLatestVersion";

export default function useNavigationMenu() {
  const location = useLocation();
  const user = useUser();
  const latestVersion = useLatestVersion();
  const clientLatestVersion = __VITE_BUILD_ID__;

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

  const mesFeiMenuCommon = {
    text: "Mes FEI",
    isActive: location.pathname === "/app/tableau-de-bord" || location.pathname.startsWith("/app/tableau-de-bord/fei"),
  };
  const mesFeiMenu: MainNavigationProps.Item = isExaminateurInitial
    ? {
        ...mesFeiMenuCommon,
        menuLinks: [
          {
            text: "Toutes mes FEI",
            isActive: location.pathname === "/app/tableau-de-bord",
            linkProps: {
              to: "/app/tableau-de-bord",
              href: "#",
            },
          },
          {
            text: "Nouvelle FEI",
            isActive: location.pathname === "/app/tableau-de-bord/fei/nouvelle",
            linkProps: {
              to: "/app/tableau-de-bord/fei/nouvelle",
              href: "#",
            },
          },
        ],
      }
    : { ...mesFeiMenuCommon, linkProps: { to: "/app/tableau-de-bord", href: "#" } };

  const navigationBase: MainNavigationProps.Item[] = [
    {
      text: "Mon profil",
      isActive: location.pathname.startsWith("/app/tableau-de-bord/mon-profil"),
      menuLinks: profileMenu,
    },
    mesFeiMenu,
    {
      text: !import.meta.env.PROD
        ? `Déconnexion ${user?.email} (${user?.roles.map((ro) => ro.slice(0, 3)).join("-")})`
        : "Se déconnecter",
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
          text: "Liste des FEI",
          isActive: location.pathname === "/app/tableau-de-bord/admin/feis",
          linkProps: {
            href: "#",
            to: "/app/tableau-de-bord/admin/feis",
          },
        },
      ],
    });
  }

  console.log("latestVersion", latestVersion);
  console.log("clientLatestVersion", clientLatestVersion);

  if (latestVersion !== clientLatestVersion) {
    navigationBase.push({
      text: "Obtenir la dernière version de l'app",
      linkProps: {
        href: "#",
        onClick: () => clearCache().then(() => window.location.reload()),
      },
    });
  }

  return navigationBase;
}
