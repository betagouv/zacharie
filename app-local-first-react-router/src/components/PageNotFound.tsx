import { useNavigate } from 'react-router';
import compass from '@codegouvfr/react-dsfr/dsfr/artwork/pictograms/map/compass.svg?url';
import artworkDarkSvgUrl from '@codegouvfr/react-dsfr/dsfr/artwork/background/ovoid.svg?url';

export default function PageNotFound() {
  const navigate = useNavigate();
  return (
    <main
      role="main"
      id="content"
      className="flex min-h-[80vh] items-center justify-center"
    >
      <div className="fr-container flex flex-col items-center text-center fr-py-7w">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="fr-artwork mb-8 w-48 md:w-64"
          aria-hidden="true"
          viewBox="0 0 160 200"
        >
          <use
            className="fr-artwork-motif"
            href={`${artworkDarkSvgUrl}#artwork-motif`}
          ></use>
          <use
            className="fr-artwork-background"
            href={`${artworkDarkSvgUrl}#artwork-background`}
          ></use>
          <g transform="translate(40, 60)">
            <use
              className="fr-artwork-decorative"
              href={`${compass}#artwork-decorative`}
            ></use>
            <use
              className="fr-artwork-minor"
              href={`${compass}#artwork-minor`}
            ></use>
            <use
              className="fr-artwork-major"
              href={`${compass}#artwork-major`}
            ></use>
          </g>
        </svg>
        <p className="fr-text--sm fr-mb-1w uppercase tracking-widest text-gray-500">Erreur 404</p>
        <h1 className="fr-display--xs fr-mb-2w">Mince, Zach'a pas trouvé</h1>
        <p className="fr-text--lead fr-mb-6w max-w-xl text-gray-600">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <button
          type="button"
          className="fr-btn fr-btn--lg"
          onClick={() => navigate(-1)}
        >
          Retour
        </button>
      </div>
    </main>
  );
}
