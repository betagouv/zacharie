import { Header } from "@codegouvfr/react-dsfr/Header";
import { Outlet, useSubmit } from "@remix-run/react";

export default function TableauDeBordIndex() {
  const submit = useSubmit();

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
        className="[&_p.fr-header\_\_service-tagline]:hidden md:[&_p.fr-header\_\_service-tagline]:block"
        navigation={[
          {
            linkProps: {
              onClick: handleLogout,
              type: "submit",
              href: "#",
            },
            text: "Se déconnecter",
          },
          {
            linkProps: {
              href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de mon tableau de bord à Zacharie`,
            },
            text: "Contactez-nous",
          },
        ]}
        serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
        serviceTitle="Zacharie"
      />
      <Outlet />
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