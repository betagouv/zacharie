import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import compass from '@codegouvfr/react-dsfr/dsfr/artwork/pictograms/map/compass.svg?url';
import artworkDarkSvgUrl from '@codegouvfr/react-dsfr/dsfr/artwork/background/ovoid.svg?url';
import { trackEvent } from '@app/services/matomo';
import { capture } from '@app/services/sentry';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import useUser from '@app/zustand/user';

export default function PageNotFound() {
  const navigate = useNavigate();
  const user = useUser((state) => state.user);

  // Ce 404 est un rendu silencieux : sans report explicite il est invisible
  // dans Sentry et noyé dans Matomo. On logge le chemin + la plateforme pour
  // identifier les URLs fautives (initial-path périmé côté natif vs liens
  // d'email ouverts dans le navigateur).
  useEffect(() => {
    const { pathname, search } = window.location;
    const platform = window.ReactNativeWebView ? 'native' : 'web';
    trackEvent('error', '404', pathname + search);
    capture('PageNotFound 404', {
      extra: { pathname, search, platform, referrer: document.referrer },
    });
  }, []);

  // Auto-réparation côté natif : l'app Expo rejoue au démarrage un `initial-path`
  // figé en AsyncStorage qui peut pointer vers une route supprimée (ex.
  // `/app/tableau-de-bord`, retiré en #391) -> 404 au cold start. Plutôt que
  // d'afficher le 404, on renvoie l'utilisateur vers sa vraie destination et on
  // réécrit le `initial-path` stocké pour que le bug ne se reproduise plus.
  useEffect(() => {
    if (!window.ReactNativeWebView) return;
    let target = '/';
    try {
      if (user) target = getUserOnboardingRoute(user);
    } catch {
      target = '/';
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ event: 'save-initial-path', initialPath: target })
    );
    navigate(target, { replace: true });
  }, [user, navigate]);

  return (
    <main
      role="main"
      id="content"
      className="flex min-h-[80vh] items-center justify-center"
    >
      <div className="fr-container fr-py-7w flex flex-col items-center text-center">
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
        <p className="fr-text--sm fr-mb-1w tracking-widest text-gray-500 uppercase">Erreur 404</p>
        <h1 className="fr-display--xs fr-mb-2w">Mince, Zach'a pas trouvé</h1>
        <p className="fr-text--lead fr-mb-6w max-w-xl text-gray-600">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <button
          type="button"
          className="fr-btn fr-btn--lg"
          onClick={() => {
            let target = '/';
            try {
              if (user) target = getUserOnboardingRoute(user);
            } catch {
              target = '/';
            }
            navigate(target);
          }}
        >
          Accueil
        </button>
      </div>
    </main>
  );
}
