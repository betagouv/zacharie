// Pages qui portent elles-mêmes un `?redirect=` : on ne les prend jamais comme destination,
// on suit leur propre `redirect` pour ne garder que la page finale.
const PAGES_WITH_REDIRECT = ['/app/connexion', '/app/proconnect'];
const MAX_NESTING = 5;

function isSafeAppPath(path: string) {
  if (path !== '/app' && !path.startsWith('/app/')) return false;
  if (path.startsWith('//') || path.includes('\\')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(path)) return false;
  return true;
}

// Seules les routes internes de l'app sont acceptées comme destination d'un `?redirect=` :
// react-router envoie une URL absolue (`https://…`, `//…`, `javascript:…`) à `window.location`.
// Le résultat ne contient jamais de `redirect` imbriqué : `/app/proconnect?redirect=/app/admin`
// devient `/app/admin`, et un éventuel `redirect` dans la page finale est retiré.
export function sanitizeRedirect(redirect: string | null | undefined): string | null {
  let current = redirect;
  for (let level = 0; level < MAX_NESTING; level++) {
    if (!current || !isSafeAppPath(current)) return null;
    const url = new URL(current, 'http://zacharie.local');
    // `new URL` résout les `..` : on revérifie le chemin obtenu
    if (!isSafeAppPath(url.pathname)) return null;
    const isPageWithRedirect = PAGES_WITH_REDIRECT.some(
      (page) => url.pathname === page || url.pathname.startsWith(`${page}/`)
    );
    if (isPageWithRedirect) {
      current = url.searchParams.get('redirect');
      continue;
    }
    url.searchParams.delete('redirect');
    return url.pathname + url.search + url.hash;
  }
  return null;
}

// `/app/connexion` avec la page courante en `redirect` (ou sans `redirect` si elle n'est pas valide)
export function buildConnexionUrl(currentPath: string) {
  const redirect = sanitizeRedirect(currentPath);
  return redirect ? `/app/connexion?redirect=${encodeURIComponent(redirect)}` : '/app/connexion';
}

// `/app/proconnect` avec la page admin demandée en `redirect`
export function buildProConnectUrl(currentPath: string) {
  const redirect = sanitizeRedirect(currentPath) || '/app/admin';
  return `/app/proconnect?redirect=${encodeURIComponent(redirect)}`;
}
