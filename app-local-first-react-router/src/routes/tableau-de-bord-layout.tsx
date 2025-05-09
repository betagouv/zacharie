import { Outlet, useLocation } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { useEffect } from 'react';

export default function TableauDeBordLayout() {
  const location = useLocation();
  const user = useMostFreshUser('TableauDeBordLayout');
  const navigation = useNavigationMenu();

  useEffect(() => {
    refreshUser('TableauDeBordLayout');
  }, []);

  if (!user) {
    return <Chargement />;
  }
  if (!user?.activated && !location.pathname.includes('mon-profil') && !location.pathname.includes('admin')) {
    return (
      <RootDisplay hideMinistereName navigation={navigation} id="tableau-de-bord-layout-not-activated">
        <main role="main" id="content">
          <title>
            Compte en cours d'activation | Zacharie | Ministère de l'Agriculture et de la Souveraineté
            Alimentaire
          </title>
          <div className="fr-container">
            <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
              <div className="fr-py-0 fr-col-12 fr-col-md-6">
                <h1 className="fr-h1">Compte en cours d'activation</h1>
                <p className="fr-text--lead fr-mb-3w">
                  Veuillez patienter, votre compte est en cours d'activation.
                </p>
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
    <RootDisplay navigation={navigation} hideMinistereName id="tableau-de-bord-layout-activated">
      <main
        role="main"
        id="content"
        className="fr-background-alt--blue-france relative min-h-full overflow-auto"
      >
        <Outlet />
      </main>
    </RootDisplay>
  );
}
