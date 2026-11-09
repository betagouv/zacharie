import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import compass from '@codegouvfr/react-dsfr/dsfr/artwork/pictograms/map/compass.svg?url';
import artworkDarkSvgUrl from '@codegouvfr/react-dsfr/dsfr/artwork/background/ovoid.svg?url';
import { trackEvent } from '@app/services/matomo';
import { capture } from '@app/services/sentry';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import useUser from '@app/zustand/user';

// Chemins sondés par des robots (scanners de failles, crawlers) : on ne les
// envoie pas à Sentry. Liste à compléter quand de nouveaux chemins apparaissent.
const BOT_PATH_PATTERNS: RegExp[] = [
  /^\/index(\.\w+)?\/?$/i,
  /^\/assets\//i,
  /^\/beta-testeurs/i,
  /^\/\./, // .env, .git, .aws, .well-known, .DS_Store...
  /^\/(wp-|wordpress|wp\/)/i,
  /^\/(xmlrpc|phpinfo|info|test|shell|config|setup|install)\.php/i,
  /^\/(phpmyadmin|pma|myadmin|mysql|adminer)/i,
  /^\/(cgi-bin|vendor|node_modules|backup|backups|old|bak|tmp|temp)\b/i,
  /^\/(owa|ecp|autodiscover|remote|boaform|hnap1|actuator|server-status|solr|telescope|console)\b/i,
  /^\/(api|graphql|v1|v2)\b/i,
  /^\/(administrator|admin\.php|login\.php|user\/login)/i,
  /^\/(sitemap|feed|rss|ads\.txt|app-ads\.txt|security\.txt|humans\.txt)/i,
  /^\/apple-touch-icon/i,
  /\.(php\d?|asp|aspx|jsp|cgi|pl|env|sql|bak|old|zip|tar|gz|rar|7z|ini|conf|cfg|yml|yaml|log|swp)$/i,
];

function isBotPath(pathname: string) {
  return BOT_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

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
    // navigation.type distingue un cold-start (`navigate`) d'un reload ou d'un
    // back/forward : un `navigate` + `referrer` vide en natif = signature d'un
    // `initial-path` périmé rejoué au démarrage (cf. réparation plus bas).
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    trackEvent('error', '404', pathname + search);
    if (isBotPath(pathname)) return;
    // L'identité (id/rôle) est déjà attachée globalement via Sentry.setUser
    // dans App.tsx. Ici on ajoute le contexte propre à la route : des tags
    // filtrables/groupables dans l'UI + le userAgent (version app native / OS).
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
  }, [user]);

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
