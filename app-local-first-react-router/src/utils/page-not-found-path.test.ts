import { describe, expect, it } from 'vitest';
import { getPathWithoutTrailingPunctuation, isBotPath } from './page-not-found-path';

describe('isBotPath', () => {
  it.each([
    '/Index',
    '/index',
    '/index.php',
    '/node_modules',
    '/node_modules/.bin',
    '/assets/',
    '/.env',
    '/wp-login.php',
  ])('ignore le chemin de robot %s', (pathname) => {
    expect(isBotPath(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/)',
    '/app/tableau-de-bord/mon-profil/mes-roles',
    '/app/chasseur/fei/ZACH-20250707-QZ6E0-185242',
    '/app/inconnu',
  ])('remonte le chemin applicatif %s', (pathname) => {
    expect(isBotPath(pathname)).toBe(false);
  });
});

describe('getPathWithoutTrailingPunctuation', () => {
  it.each([
    ['/)', '/'],
    ['/%29', '/'],
    ['/).', '/'],
    ['/app/chasseur)', '/app/chasseur'],
    ['/app/chasseur.', '/app/chasseur'],
    ['/app/chasseur/fei/ZACH-20250707-QZ6E0-185242),', '/app/chasseur/fei/ZACH-20250707-QZ6E0-185242'],
  ])('%s -> %s', (pathname, expected) => {
    expect(getPathWithoutTrailingPunctuation(pathname)).toBe(expected);
  });

  it.each(['/', '/app/chasseur', '/app/tableau-de-bord/mon-profil/mes-roles', '/index.html'])(
    'laisse %s tel quel (renvoie null)',
    (pathname) => {
      expect(getPathWithoutTrailingPunctuation(pathname)).toBeNull();
    }
  );
});
