import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import compass from '@codegouvfr/react-dsfr/dsfr/artwork/pictograms/map/compass.svg?url';
import artworkDarkSvgUrl from '@codegouvfr/react-dsfr/dsfr/artwork/background/ovoid.svg?url';
import { trackEvent } from '@app/services/matomo';
import { capture } from '@app/services/sentry';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { getPathWithoutTrailingPunctuation, isBotPath } from '@app/utils/page-not-found-path';
import useUser from '@app/zustand/user';

export default function PageNotFound() {
  const navigate = useNavigate();
  const user = useUser((state) => state.user);
  const pathWithoutTrailingPunctuation = getPathWithoutTrailingPunctuation(window.location.pathname);

  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathWithoutTrailingPunctuation) {
      navigate(pathWithoutTrailingPunctuation + search + hash, { replace: true });
      return;
    }
    const platform = window.ReactNativeWebView ? 'native' : 'web';
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    trackEvent('error', '404', pathname + search);
    if (isBotPath(pathname)) return;
    capture('PageNotFound 404', {
      tags: {
        error_404: 'true',
        platform,
        role: user?.roles?.[0] ?? 'anonymous',
        navigation_type: navEntry?.type ?? 'unknown',
      },
      extra: {
        pathname,
        search,
        platform,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      },
    });
  }, [user, navigate, pathWithoutTrailingPunctuation]);

  useEffect(() => {
    if (!window.ReactNativeWebView) return;
    if (pathWithoutTrailingPunctuation) return;
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
  }, [user, navigate, pathWithoutTrailingPunctuation]);

  return (
    <main
      role="main"
      id="content"
      className="flex min-h-[80vh] items-center justify-center"
    >
      <div className="fr-container fr-py-7w flex flex-col items-center text-center">
        <title>
          Page non trouvée | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
        </title>
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
        <h1 className="fr-display--xs fr-mb-2w">Mince, Zach'a ri-en trouvé</h1>
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
