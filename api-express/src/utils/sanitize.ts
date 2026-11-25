import xss from 'xss';

export function sanitize(source: string) {
  return xss(source, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
  });
}

export function escapeBrevoPlaceholders(source: string) {
  return source.replace(/\{(?=[{%])/g, '{ ');
}

export function normalizeNumeroCfei(source: string | null | undefined) {
  if (!source) return null;
  return sanitize(source).trim() || null;
}
