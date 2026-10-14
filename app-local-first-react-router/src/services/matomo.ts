import type { MatomoAction, MatomoCategory, MatomoName } from './matomo-events';

// Matomo configuration from environment variables
const MATOMO_URL = import.meta.env.VITE_MATOMO_URL;
const MATOMO_SITE_ID = import.meta.env.VITE_MATOMO_SITE_ID;

// Only initialize Matomo in production or if explicitly enabled
const isMatomoEnabled = import.meta.env.PROD && MATOMO_URL && MATOMO_SITE_ID;

// Declare Matomo _paq global
declare global {
  interface Window {
    _paq: Array<unknown[]>;
  }
}

// Initialize Matomo tracking
export function initMatomo(): void {
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Tracking disabled (not in production or missing config)');
    }
    return;
  }

  // Initialize _paq array if it doesn't exist
  window._paq = window._paq || [];

  // Configure Matomo tracker
  const matomoUrl = MATOMO_URL.endsWith('/') ? MATOMO_URL.slice(0, -1) : MATOMO_URL;

  window._paq.push(['setTrackerUrl', `${matomoUrl}/matomo.php`]);
  window._paq.push(['setSiteId', MATOMO_SITE_ID]);
  window._paq.push(['setSecureCookie', true]);
  window._paq.push(['enableLinkTracking']);

  // Load Matomo script asynchronously
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = `${matomoUrl}/matomo.js`;
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  if (import.meta.env.DEV) {
    console.log('[Matomo] Initialized with URL:', matomoUrl, 'Site ID:', MATOMO_SITE_ID);
  }
}

// Custom dimension IDs configured in Matomo admin (Settings → Custom Dimensions).
// Scope: Visit.
export const MATOMO_DIMENSION_CONNEXION = 1;
export const MATOMO_DIMENSION_ADMIN = 2;
export const MATOMO_DIMENSION_ROLE = 3;

export function setCustomDimensions(user: { isZacharieAdmin: boolean; roles: string[] } | null): void {
  if (!window._paq) {
    window._paq = [];
  }

  window._paq.push(['setCustomDimension', MATOMO_DIMENSION_CONNEXION, user ? 'connecté' : 'non connecté']);
  window._paq.push([
    'setCustomDimension',
    MATOMO_DIMENSION_ADMIN,
    user?.isZacharieAdmin ? 'admin' : 'non admin',
  ]);
  window._paq.push(['setCustomDimension', MATOMO_DIMENSION_ROLE, user?.roles[0] ?? 'aucun']);

  if (import.meta.env.DEV) {
    console.log(
      '[Matomo] Custom dimensions:',
      user ? 'connecté' : 'non connecté',
      user?.isZacharieAdmin ? 'admin' : 'non admin',
      user?.roles[0] ?? 'aucun'
    );
  }
}

export function trackPageView(path?: string, title?: string): void {
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Page view:', path || window.location.pathname, title);
    }
    return;
  }

  // Initialize _paq if not already done
  if (!window._paq) {
    window._paq = [];
  }

  if (path) {
    window._paq.push(['setCustomUrl', path]);
  }

  if (title) {
    window._paq.push(['setDocumentTitle', title]);
  }

  window._paq.push(['trackPageView']);
}

export function trackEvent(category: string, action: string, name?: string, value?: number): void {
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Event:', category, action, name, value);
    }
    return;
  }

  // Initialize _paq if not already done
  if (!window._paq) {
    window._paq = [];
  }

  const eventParams: unknown[] = ['trackEvent', category, action];
  if (name) {
    eventParams.push(name);
  }
  if (value !== undefined) {
    eventParams.push(value);
  }

  window._paq.push(eventParams);
}

// Track une feature de l'interface (filtre, tri, vue, export...).
// RGPD : name = la dimension utilisée (ex: 'statut'), jamais la valeur saisie par l'utilisateur.
export function trackFeature(category: string, action: string, name?: string, value?: number): void {
  trackEvent(category, action, name, value);
}

// Track l'usage d'une recherche sans en envoyer le contenu (qui peut être une donnée personnelle).
// Debounce : ne fire qu'une fois quand l'utilisateur arrête de taper.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
export function trackSearch(category: string): void {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => trackEvent(category, 'recherche'), 1500);
}

// Événement métier, typé par le catalogue de matomo-events.ts.
export function track<C extends MatomoCategory, A extends MatomoAction<C>>(
  category: C,
  action: A,
  name?: MatomoName<C, A>,
  value?: number
): void {
  const reseau = navigator.onLine ? 'en ligne' : 'hors ligne';
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Event:', category, action, name, value, reseau);
    }
    return;
  }
  if (!window._paq) {
    window._paq = [];
  }
  window._paq.push(['trackEvent', category, action, name, value]);
}

// numéro de fiche (ZACH-…), id numérique, uuid/cuid ; pas les étapes du type `3-informations-de-chasse`
function isIdentifier(segment: string): boolean {
  const decoded = decodeURIComponent(segment);
  return /\d{3,}/.test(decoded) || /^\d+$/.test(decoded) || (decoded.length >= 20 && /\d/.test(decoded));
}

// Remplace les identifiants d'une URL par `:id` pour regrouper les clics par écran.
export function normalizePathForTracking(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (isIdentifier(segment) ? ':id' : segment))
    .join('/');
}

// Pour les props objet (linkProps, nativeButtonProps des composants DSFR) qui refusent `data-*` en littéral.
// En JSX direct, écrire `data-matomo="..."`.
export function matomoClickId(id: string): Record<string, string> {
  return { 'data-matomo': id };
}

// Clic sur un élément portant `data-matomo="<identifiant-stable>"`.
// Seuls les éléments annotés sont suivis : leur libellé peut contenir des données personnelles.
export function trackClick(element: HTMLElement): void {
  const id = element.dataset.matomo;
  if (!id) {
    return;
  }
  trackEvent('clic', id, normalizePathForTracking(window.location.pathname));
}
