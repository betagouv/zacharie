import type { MatomoAction, MatomoCategory, MatomoName } from './matomo-events';

const MATOMO_URL = import.meta.env.VITE_MATOMO_URL;
const MATOMO_SITE_ID = import.meta.env.VITE_MATOMO_SITE_ID;

const isMatomoEnabled = import.meta.env.PROD && MATOMO_URL && MATOMO_SITE_ID;

declare global {
  interface Window {
    _paq: Array<unknown[]>;
  }
}

export function initMatomo(): void {
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Tracking disabled (not in production or missing config)');
    }
    return;
  }

  window._paq = window._paq || [];

  const matomoUrl = MATOMO_URL.endsWith('/') ? MATOMO_URL.slice(0, -1) : MATOMO_URL;

  window._paq.push(['setTrackerUrl', `${matomoUrl}/matomo.php`]);
  window._paq.push(['setSiteId', MATOMO_SITE_ID]);
  window._paq.push(['setSecureCookie', true]);
  window._paq.push(['enableLinkTracking']);

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

export function trackFeature(category: string, action: string, name?: string, value?: number): void {
  trackEvent(category, action, name, value);
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
export function trackSearch(category: string): void {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => trackEvent(category, 'recherche'), 1500);
}

export function track<C extends MatomoCategory, A extends MatomoAction<C>>(
  category: C,
  action: A,
  name?: MatomoName<C, A>,
  value?: number
): void {
  if (!isMatomoEnabled) {
    if (import.meta.env.DEV) {
      console.log('[Matomo] Event:', category, action, name, value);
    }
    return;
  }
  if (!window._paq) {
    window._paq = [];
  }
  window._paq.push(['trackEvent', category, action, name, value]);
}

function isIdentifier(segment: string): boolean {
  const decoded = decodeURIComponent(segment);
  return /\d{3,}/.test(decoded) || /^\d+$/.test(decoded) || (decoded.length >= 20 && /\d/.test(decoded));
}

export function normalizePathForTracking(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (isIdentifier(segment) ? ':id' : segment))
    .join('/');
}

export function matomoClickId(id: string): Record<string, string> {
  return { 'data-matomo': id };
}

export function trackClick(element: HTMLElement): void {
  const id = element.dataset.matomo;
  if (!id) {
    return;
  }
  trackEvent('clic', id, normalizePathForTracking(window.location.pathname));
}
