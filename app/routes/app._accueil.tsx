import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Outlet } from "@remix-run/react";
// import type { MetaFunction } from "@remix-run/node";

// export const meta: MetaFunction = () => {
//   return [
//     { title: "New Remix App" },
//     { name: "description", content: "Welcome to Remix!" },
//   ];
// };

export default function AccueilLayout() {
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
        quickAccessItems={[
          {
            linkProps: {
              to: "/app/connexion?type=compte-existant",
              href: "#",
            },
            iconId: "ri-account-box-line",
            text: "Se connecter",
          },
          {
            linkProps: {
              to: "/app/connexion?type=creation-de-compte",
              href: "#",
            },
            iconId: "fr-icon-add-circle-line",
            text: "Créer un compte",
          },
          {
            iconId: "fr-icon-mail-fill",
            linkProps: {
              href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de ma connexion à Zacharie`,
            },
            text: "Contactez-nous",
          },
        ]}
        serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
        serviceTitle="Zacharie"
      />
      <Outlet />
      <Footer
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
      />
    </>
  );
}