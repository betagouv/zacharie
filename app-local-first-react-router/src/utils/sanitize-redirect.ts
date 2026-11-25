export function sanitizeRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null;
  if (redirect !== '/app' && !redirect.startsWith('/app/')) return null;
  if (redirect.startsWith('//') || redirect.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(redirect)) return null;
  return redirect;
}
