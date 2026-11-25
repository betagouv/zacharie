const BOT_PATH_PATTERNS: RegExp[] = [
  /^\/index(\.\w+)?\/?$/i,
  /^\/assets\//i,
  /^\/beta-testeurs/i,
  /^\/\./,
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

export function isBotPath(pathname: string) {
  return BOT_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

const TRAILING_PUNCTUATION = /(?:[)\].,;:!?'"»>]|%29|%5D|%22|%C2%BB)+$/i;

export function getPathWithoutTrailingPunctuation(pathname: string): string | null {
  if (!TRAILING_PUNCTUATION.test(pathname)) return null;
  return pathname.replace(TRAILING_PUNCTUATION, '') || '/';
}
