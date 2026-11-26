// Même règle que app-local-first-react-router/src/utils/sanitize-redirect.ts : seule une route interne
// `/app/...` est acceptée, sans `redirect` imbriqué. `/app/proconnect?redirect=/app/admin/users`
// devient `/app/admin/users`.
const PAGES_WITH_REDIRECT = ['/app/connexion', '/app/proconnect'];
const MAX_NESTING = 5;

function isSafeAppPath(path: string) {
  if (path !== '/app' && !path.startsWith('/app/')) return false;
  if (path.startsWith('//') || path.includes('\\')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(path)) return false;
  return true;
}

export function sanitizeAppRedirect(redirect: unknown): string | null {
  let current = typeof redirect === 'string' ? redirect : null;
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
