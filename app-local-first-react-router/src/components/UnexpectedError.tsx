import { useLocation } from 'react-router';
import technicalError from '@codegouvfr/react-dsfr/dsfr/artwork/pictograms/system/technical-error.svg?url';
import artworkDarkSvgUrl from '@codegouvfr/react-dsfr/dsfr/artwork/background/ovoid.svg?url';

export default function UnexpectedError({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  const location = useLocation();
  return (
    <main role="main" id="content">
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <h1 className="fr-h1">Erreur inattendue</h1>
            <p className="fr-h2 fr-text--sm fr-mb-3w">Erreur 500</p>
            <p className="fr-text--sm fr-mb-5w">
              Désolé, le service rencontre un problème, nous travaillons pour le résoudre le plus rapidement
              possible.
            </p>
            <p className="fr-text--lead fr-mb-3w">
              Essayez de rafraîchir la page ou bien ressayez plus tard.
            </p>
            <ul className="fr-btns-group fr-btns-group--inline-md">
              <li>
                <button type="button" className="fr-btn" onClick={resetErrorBoundary}>
                  Page d'accueil
                </button>
              </li>
              <li>
                <a
                  className="fr-btn fr-btn--secondary"
                  href={`mailto:contact@zacharie.beta.gouv.fr?subject=Erreur 500&body=Bonjour, je rencontre une erreur 500 sur la page suivante : ${location.pathname}`}
                >
                  Contactez-nous
                </a>
              </li>
            </ul>
          </div>
          <div className="fr-col-12 fr-col-md-3 fr-col-offset-md-1 fr-px-6w fr-px-md-0 fr-py-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="fr-responsive-img fr-artwork"
              aria-hidden="true"
              width="160"
              height="200"
              viewBox="0 0 160 200"
            >
              <use className="fr-artwork-motif" href={`${artworkDarkSvgUrl}#artwork-motif`}></use>
              <use className="fr-artwork-background" href={`${artworkDarkSvgUrl}#artwork-background`}></use>
              <g transform="translate(40, 60)">
                <use className="fr-artwork-decorative" href={`${technicalError}#artwork-decorative`}></use>
                <use className="fr-artwork-minor" href={`${technicalError}#artwork-minor`}></use>
                <use className="fr-artwork-major" href={`${technicalError}#artwork-major`}></use>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </main>
  );
}
