import { Link } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useEffect } from 'react';
import { hasAllRequiredFields } from '@app/utils/user';

export default function DeactivatedAccount() {
  const navigation = useLoggedInNavigationMenu();
  const user = useMostFreshUser('DeactivatedAccount');
  const isProfileCompleted = hasAllRequiredFields(user!);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <RootDisplay hideMinistereName navigation={navigation} id="tableau-de-bord-layout-not-activated">
      <main role="main" id="content" className="fr-background-alt--blue-france relative min-h-full overflow-auto">
        <title>
          Compte en attente d’activation | Zacharie | Ministère de l’Agriculture et de la Souveraineté
          Alimentaire
        </title>
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
              <div className="mb-6 bg-white md:shadow-sm">
                <div className="p-4 md:p-8">
                  <h1 className="fr-h2 fr-mb-2w">
                    {isProfileCompleted ? (
                      <>Merci pour votre inscription à Zacharie&nbsp;!</>
                    ) : (
                      <>Votre profil doit être complété pour valider votre compte</>
                    )}
                  </h1>
                  {isProfileCompleted ? (
                    <p className="fr-text--sm fr-mb-3w">
                      Nous vérifions les informations que vous avez renseignées.
                      <br />
                      Nous vous enverrons un mail pour confirmer l’activation de votre compte ou vous demander des
                      informations complémentaires.
                    </p>
                  ) : (
                    <>
                      <p className="fr-text--sm fr-mb-3w">
                        Afin de valider votre compte, complétez les informations manquantes.
                      </p>
                      <ul className="fr-btns-group fr-btns-group--inline-md fr-mb-3w">
                        <li>
                          <Link className="fr-btn" to="/app/tableau-de-bord/onboarding/mes-coordonnees">
                            Compléter votre profile
                          </Link>
                        </li>
                      </ul>
                    </>
                  )}
                  <p className="fr-text--sm fr-mb-2w">Des questions ? Contactez-nous :</p>
                  <ul className="fr-text--sm mb-0 list-inside list-disc">
                    <li>
                      par mail : <a href="mailto:contact@zacharie.beta.gouv.fr">contact@zacharie.beta.gouv.fr</a>
                    </li>
                    <li>
                      par téléphone : <a href="tel:+33189316640">01 89 31 66 40</a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </RootDisplay>
  );
}
