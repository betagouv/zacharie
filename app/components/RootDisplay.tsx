import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { type MainNavigationProps } from "@codegouvfr/react-dsfr/MainNavigation";

export default function RootDisplay({
  navigation,
  children,
  hideMinistereName,
}: {
  navigation?: MainNavigationProps.Item[];
  children: React.ReactNode;
  hideMinistereName?: boolean;
}) {
  return (
    <>
      <Header
        brandTop={
          <span className={hideMinistereName ? "hidden md:inline" : ""}>
            Ministère
            <br />
            de l'Agriculture
            <br />
            et de la Souveraineté
            <br />
            Alimentaire et de la Forêt
          </span>
        }
        homeLinkProps={{
          to: "/",
          title: "Zacharie | Ministère de l'Agriculture",
        }}
        id="fr-header-header-with-quick-access-items"
        className="[&_.fr-header\_\_service-title]:flex [&_.fr-header\_\_service-title]:items-end"
        navigation={navigation}
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
              // to: "/app/connexion?type=creation-de-compte",
              to: "/beta-testeurs",
              href: "#",
            },
            iconId: "fr-icon-add-circle-line",
            text: "Créer un compte",
          },
          {
            iconId: "fr-icon-mail-fill",
            linkProps: {
              href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de Zacharie`,
            },
            text: "Contact",
          },
        ]}
        operatorLogo={{
          alt: "Logo de Zacharie - un bois de cerf bland sur fond bleu avec liseré rouge",
          imgUrl: "/logo_zacharie_solo_small.svg",
          orientation: "vertical",
        }}
        serviceTagline="Garantir des viandes de gibier sauvage saines et sûres"
        serviceTitle={
          <>
            Zacharie
            <span className="ml-4 inline-block">
              <em className="mb-1 block rounded bg-green-300 px-1 text-sm not-italic text-green-900">VERSION BETA</em>
            </span>
          </>
        }
      />
      {children}
      <Footer
        accessibility="fully compliant"
        contentDescription={`
        Zacharie est un service à destination des chasseurs et des acteurs de  la filière de valorisation des viandes de gibier sauvage (collecteurs,  ETG, SVI). Il permet de créer des fiches d’examen  initial en un format numérique unique, partagé, modifiable et traçable  par tous les acteurs.
        Dernière mise à jour le ${__VITE_BUILD_ID__}
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
