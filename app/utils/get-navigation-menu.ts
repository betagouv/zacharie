import { UserRoles } from "@prisma/client";
import { useLocation, useSubmit } from "@remix-run/react";
import { useUser } from "./useUser";

export default function useNavigationMenu() {
  const submit = useSubmit();
  const location = useLocation();
  const user = useUser();

  const handleLogout = () => {
    submit(null, { method: "post", action: "/actions/logout" });
  };

  const isOnlyExaminateurInitial = user!.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && user!.roles.length === 1;
  const isAdmin = user!.roles.includes(UserRoles.ADMIN);

  const profileMenu = [
    {
      text: "Mes roles",
      isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-roles",
      linkProps: {
        to: "/tableau-de-bord/mon-profil/mes-roles",
        href: "#",
      },
    },
    {
      text: "Mes informations",
      isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-informations",
      linkProps: {
        href: "#",
        to: "/tableau-de-bord/mon-profil/mes-informations",
      },
    },
  ];
  if (!isOnlyExaminateurInitial) {
    profileMenu.push({
      text: "Mes partenaires",
      isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-partenaires",
      linkProps: {
        href: "#",
        to: "/tableau-de-bord/mon-profil/mes-partenaires",
      },
    });
  }
  profileMenu.push({
    text: "Mes notifications",
    isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-notifications",
    linkProps: {
      href: "#",
      to: "/tableau-de-bord/mon-profil/mes-notifications",
    },
  });

  const navigationBase = [
    {
      text: "Mon profil",
      isActive: location.pathname.startsWith("/tableau-de-bord/mon-profil"),
      menuLinks: profileMenu,
    },
    {
      text: "Mes FEI",
      isActive: location.pathname === "/tableau-de-bord" || location.pathname.startsWith("/tableau-de-bord/fei"),
      menuLinks: [
        {
          text: "Nouvelle FEI",
          isActive: location.pathname === "/tableau-de-bord/fei/nouvelle",
          linkProps: {
            to: "/tableau-de-bord/fei/nouvelle",
            href: "#",
          },
        },
        {
          text: "Mes FEI",
          isActive: location.pathname === "/tableau-de-bord",
          linkProps: {
            to: "/tableau-de-bord",
            href: "#",
          },
        },
      ],
    },
    {
      text: "Se déconnecter",
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
      isActive: location.pathname.startsWith("/tableau-de-bord/admin"),
      menuLinks: [
        {
          text: "Liste des utilisateurs",
          isActive: location.pathname === "/tableau-de-bord/admin/utilisateurs",
          linkProps: {
            href: "#",
            to: "/tableau-de-bord/admin/utilisateurs",
          },
        },
        {
          text: "+ Ajouter des utilisateurs",
          isActive: location.pathname === "/tableau-de-bord/admin/ajouter-utilisateur",
          linkProps: {
            href: "#",
            to: "/tableau-de-bord/admin/utilisateur/nouveau",
          },
        },
        {
          text: "Liste des entités",
          isActive: location.pathname === "/tableau-de-bord/admin/entites",
          linkProps: {
            href: "#",
            to: "/tableau-de-bord/admin/entites",
          },
        },
        {
          text: "+ Ajouter des entités (SVI, ETG, etc.)",
          isActive: location.pathname === "/tableau-de-bord/admin/ajouter-entite",
          linkProps: {
            href: "#",
            to: "/tableau-de-bord/admin/entite/nouvelle",
          },
        },
        {
          text: "Liste des FEI",
          isActive: location.pathname === "/tableau-de-bord/admin/feis",
          linkProps: {
            href: "#",
            to: "/tableau-de-bord/admin/feis",
          },
        },
      ],
    });
  }
  return navigationBase;
}
