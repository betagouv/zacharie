import { Outlet, useLocation } from "@remix-run/react";
import RootDisplay from "~/components/RootDisplay";
import useNavigationMenu from "~/utils/get-navigation-menu";
import { useUser } from "~/utils/useUser";

export default function TableauDeBordLayout() {
  const location = useLocation();
  const user = useUser();
  const navigation = useNavigationMenu();

  if (!user?.activated && !location.pathname.includes("mon-profil")) {
    return (
      <RootDisplay hideMinistereName>
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
      </RootDisplay>
    );
  }

  return (
    <RootDisplay navigation={navigation} hideMinistereName>
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
    </RootDisplay>
  );
}
