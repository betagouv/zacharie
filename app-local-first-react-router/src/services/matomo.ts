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
