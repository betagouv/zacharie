import { Header } from "@codegouvfr/react-dsfr/Header";
import { UserRoles } from "@prisma/client";
import { Outlet, useLocation, useSubmit } from "@remix-run/react";
import { useUser } from "~/utils/useUser";

export default function TableauDeBordLayout() {
  const submit = useSubmit();
  const location = useLocation();
  const user = useUser();

  const handleLogout = () => {
    submit(null, { method: "post", action: "/actions/logout" });
  };

  if (!user?.activated && !location.pathname.includes("mon-profil")) {
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
          serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
          serviceTitle="Zacharie"
        />
        <main role="main" id="content">
          <div className="fr-container">
            <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
              <div className="fr-py-0 fr-col-12 fr-col-md-6">
                <h1 className="fr-h1">Compte en cours d'activation</h1>
                <p className="fr-text--lead fr-mb-3w">Veuillez patienter, votre compte est en cours d'activation.</p>
                <p className="fr-text--sm fr-mb-5w">
                  Nos équipes vérifient les informations que vous avez renseignées.
                  <br />
                  Revenez un peu plus tard pour accéder à votre tableau de bord.
                  <br />
                  Sinon contactez-nous pour que l’on puisse vous rediriger vers la bonne information.
                </p>
                <ul className="fr-btns-group fr-btns-group--inline-md">
                  <li>
                    <a className="fr-btn" href="/">
                      Page d'accueil
                    </a>
                  </li>
                  <li>
                    <a
                      className="fr-btn fr-btn--secondary"
                      href={`mailto:contact@zacharie.beta.gouv.fr?subject=Erreur 404&body=Bonjour, je rencontre une erreur 404 sur la page suivante : ${location.pathname}`}
                    >
                      Contactez-nous
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
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
                text: "Mes FEI assignées",
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
          ...(user?.roles.includes(UserRoles.ADMIN)
            ? [
                {
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
                },
              ]
            : []),
        ]}
        serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
        serviceTitle="Zacharie"
      />
      <main role="main" id="content" className="fr-background-alt--blue-france relative min-h-full overflow-auto">
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
