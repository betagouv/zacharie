import { Outlet, useLocation } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import Chargement from '@app/components/Chargement';
import { useEffect } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function TableauDeBordLayout() {
  const location = useLocation();
  const user = useMostFreshUser('TableauDeBordLayout');
  const navigation = useLoggedInNavigationMenu();
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const isOnline = useIsOnline();
  useEffect(() => {
    refreshUser('TableauDeBordLayout');
  }, []);

  if (!user) {
    return <Chargement />;
  }
  if (!user?.activated && !location.pathname.includes('mon-profil') && !location.pathname.includes('admin')) {
    return <DeactivatedAccount />;
  }

  return (
    <>
      <RootDisplay
        navigation={navigation}
        hideMinistereName
        id="tableau-de-bord-layout-activated"
        contactLink="/app/tableau-de-bord/contact"
      >
        <main
          role="main"
          id="content"
          className="fr-background-alt--blue-france relative min-h-full overflow-auto"
        >
          <Outlet />
        </main>
      </RootDisplay>
      {!dataIsSynced && isOnline && import.meta.env.VITE_TEST_PLAYWRIGHT === 'true' && (
        <p className="text-action-high-blue-france text-opacity-25 fixed right-0 bottom-0 left-0 z-50 bg-white px-4 py-1 text-sm">
          Synchronisation en cours
        </p>
      )}
    </>
  );
}

function DeactivatedAccount() {
  const navigation = useLoggedInNavigationMenu();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <RootDisplay hideMinistereName navigation={navigation} id="tableau-de-bord-layout-not-activated">
      <main role="main" id="content">
        <title>
          Compte en attente d'activation | Zacharie | Ministère de l'Agriculture et de la Souveraineté
          Alimentaire
        </title>
        <div className="fr-container">
          <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
            <div className="fr-py-0 fr-col-12 fr-col-md-6">
              <h1 className="fr-h1">Merci pour votre inscription à Zacharie!</h1>
              <p className="fr-text--lead fr-mb-3w">Votre compte est en attente d'activation.</p>
              <p className="fr-text--sm">
                Nous vérifions les informations que vous avez renseignées.
                <br />
                Nous vous enverrons un mail pour confirmer l’activation de votre compte ou vous demander des
                informations complémentaires.
              </p>
              <p className="fr-text--sm">Des questions ? Contactez-nous :</p>
              <ul className="fr-text--sm fr-mb-5w list-inside list-disc">
                <li>
                  par mail : <a href="mailto:contact@zacharie.beta.gouv.fr">contact@zacharie.beta.gouv.fr</a>
                </li>
                <li>
                  par téléphone : <a href="tel:+33189316640">01 89 31 66 40</a>
                </li>
              </ul>
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
