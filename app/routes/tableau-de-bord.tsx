import { Header } from "@codegouvfr/react-dsfr/Header";
import { UserRoles } from "@prisma/client";
import { Outlet, useLocation, useSubmit } from "@remix-run/react";
import { useUser } from "~/utils/useUser";

export default function TableauDeBordIndex() {
  const submit = useSubmit();
  const location = useLocation();
  const user = useUser();
  console.log("user", user);

  const handleLogout = () => {
    submit(null, { method: "post", action: "/actions/logout" });
  };

  return (
    <>
      <Header
        brandTop={
          <>
            Ministère
            <br />
            de l'Agriculture
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Zacharie - Ministère de l'Agriculture",
        }}
        id="fr-header-header-with-quick-access-items"
        // check mobile responsive header classes at tailwind.css
        navigation={[
          {
            text: "Mes FEI",
            isActive: location.pathname === "/tableau-de-bord" || location.pathname.startsWith("/tableau-de-bord/fei"),
            menuLinks: [
              {
                text: "Nouvelle FEI",
                isActive: location.pathname === "/tableau-de-bord/fei",
                linkProps: {
                  to: "/tableau-de-bord/fei",
                  href: "#",
                },
              },
              {
                text: "Mes FEI assignées",
                isActive: location.pathname === "/tableau-de-bord",
                linkProps: {
                  href: "#",
                  to: "/tableau-de-bord",
                },
              },
            ],
          },
          {
            text: "Mon profil",
            isActive: location.pathname.startsWith("/tableau-de-bord/mon-profil"),
            menuLinks: [
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
              {
                text: "Mes partenaires",
                isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-partenaires",
                linkProps: {
                  href: "#",
                  to: "/tableau-de-bord/mon-profil/mes-partenaires",
                },
              },
              {
                text: "Mes notifications",
                isActive: location.pathname === "/tableau-de-bord/mon-profil/mes-notifications",
                linkProps: {
                  href: "#",
                  to: "/tableau-de-bord/mon-profil/mes-notifications",
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
          ...(user?.roles.includes(UserRoles.ADMIN)
            ? [
                {
                  text: "Admin",
                  isActive: location.pathname.startsWith("/tableau-de-bord/admin"),
                  menuLinks: [
                    {
                      text: "Ajouter des utilisateurs",
                      isActive: location.pathname === "/tableau-de-bord/ajouter-utilisateur",
                      linkProps: {
                        href: "#",
                        to: "/tableau-de-bord/ajouter-utilisateur",
                      },
                    },
                    {
                      text: "Ajouter des entités (SVI, ETG, etc.)",
                      isActive: location.pathname === "/tableau-de-bord/ajouter-entites",
                      linkProps: {
                        href: "#",
                        to: "/tableau-de-bord/ajouter-entites",
                      },
                    },
                  ],
                },
              ]
            : []),
        ]}
        serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
        serviceTitle="Zacharie"
      />
      <main role="main" id="content" className="fr-background-alt--blue-france relative overflow-auto min-h-[75vh]">
        <Outlet />
      </main>
      {/* <Footer
        accessibility="fully compliant"
        contentDescription={`
        Zacharie c’est un service à destination des chasseurs et des acteurs de la filière de valorisation des viandes de gibier sauvage (collecteurs, ETG, SVI). Elle permet aux chasseurs de créer des fiches d’examen initial en un format numérique unique, partagé, modifiable et traçable par tous les acteurs.\u000A\u000A



        Zacharie a pour objectif premier d’améliorer le niveau de complétude et de fiabilité des informations sanitaires et de traçabilité relatives aux viandes de gibier traitées. Ainsi, Zacharie contribue à améliorer la qualité sanitaire des viandes mises sur le marché, réduire les risques d’intoxication alimentaire et de gaspillage alimentaire.
        `}
        termsLinkProps={{
          href: "#",
        }}
        websiteMapLinkProps={{
          href: "#",
        }}
        // bottomItems={[
        //     headerFooterDisplayItem,
        //     <FooterPersonalDataPolicyItem />,
        //     <FooterConsentManagementItem />
        // ]}
      /> */}
    </>
  );
}
