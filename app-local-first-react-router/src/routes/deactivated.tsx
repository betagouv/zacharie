import { Link } from 'react-router';
import RootDisplay from '@app/components/RootDisplay';
import useLoggedInNavigationMenu from '@app/utils/get-navigation-menu';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useEffect } from 'react';
import { hasAllRequiredFields } from '@app/utils/user';
import { UserRoles } from '@prisma/client';

export default function DeactivatedAccount() {
  const navigation = useLoggedInNavigationMenu();
  const user = useMostFreshUser('DeactivatedAccount');
  const isProfileCompleted = hasAllRequiredFields(user!);
  const needToCompleteExaminateurInitial =
    user?.roles.includes(UserRoles.CHASSEUR) && user?.est_forme_a_l_examen_initial == null;
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
              <h1 className="fr-h1">
                {isProfileCompleted ? (
                  <>Merci pour votre inscription à Zacharie&nbsp;!</>
                ) : (
                  <>Le profil de votre compte doit être complété</>
                )}
              </h1>
              {!isProfileCompleted && (
                <p className="fr-text--lead fr-mb-3w">
                  Afin de valider votre compte, vous devez{' '}
                  <Link to="/app/tableau-de-bord/onboarding/mes-coordonnees">renseigner vos coordonnées</Link>
                  {needToCompleteExaminateurInitial && (
                    <>
                      {' '}
                      et/ou{' '}
                      <Link to="/app/tableau-de-bord/onboarding/mes-informations-de-chasse">
                        indiquer votre numéro de personne formée à l’examen initial
                      </Link>
                    </>
                  )}
                  .
                </p>
              )}
              {isProfileCompleted ? (
                <p className="fr-text--sm">
                  Nous vérifions les informations que vous avez renseignées.
                  <br />
                  Nous vous enverrons un mail pour confirmer l’activation de votre compte ou vous demander des
                  informations complémentaires.
                </p>
              ) : (
                <ul className="fr-btns-group fr-btns-group--inline-md">
                  <li>
                    <a className="fr-btn" href="/app/tableau-de-bord/onboarding/mes-coordonnees">
                      Renseignez vos coordonnées
                    </a>
                  </li>
                  {needToCompleteExaminateurInitial && (
                    <li>
                      <a
                        className="fr-btn fr-btn--secondary"
                        href="/app/tableau-de-bord/onboarding/formation-examen-initial"
                      >
                        Indiquer votre numéro de personne formée à l’examen initial
                      </a>
                    </li>
                  )}
                </ul>
              )}
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
