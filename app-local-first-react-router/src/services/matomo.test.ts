import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setCustomDimensions, MATOMO_DIMENSION_CONNEXION, MATOMO_DIMENSION_ADMIN } from './matomo';

// --- Route path inventories ---
// Landing layout children (under '/')
const LANDING_PATHS = [
  'pros',
  'demarches',
  'test-sentry',
  'mentions-legales',
  'accessibilite',
  'politique-de-confidentialite',
  'modalites-d-utilisation',
  'stats',
  'stats/matrice-impact',
  'contact',
  'faq',
  'quiz',
];

// Connexion leaf routes (under '/app/connexion')
const CONNEXION_LEAF_PATHS = [
  'creation-de-compte',
  'invitation',
  'mot-de-passe-oublie',
  'reset-mot-de-passe',
];

// Public routes outside the landing layout
const STANDALONE_PUBLIC_PATHS = ['/quiz/tv'];

// Non-public paths in App.tsx (wrappers + authenticated app routes)
const APP_NON_PUBLIC_PATHS = ['/', 'app', '*', 'proconnect', 'contact', 'nouvelle-fiche', 'tableau-de-bord'];

// Full list of public routes (used by the E2E test and exported for reuse)
export const ALL_PUBLIC_ROUTES = [
  '/',
  ...LANDING_PATHS.map((p) => `/${p}`),
  ...STANDALONE_PUBLIC_PATHS,
  '/app/connexion',
  ...CONNEXION_LEAF_PATHS.map((p) => `/app/connexion/${p}`),
];

// --- Helpers ---

function extractRoutePaths(source: string): string[] {
  const paths: string[] = [];
  const regex = /\bpath=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function countIndexRoutes(source: string): number {
  return (source.match(/<Route\s+index\b/g) || []).length;
}

// --- Unit tests: setCustomDimensions ---

describe('setCustomDimensions', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { _paq: [] as unknown[][] } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('user null → "non connecté" + "non admin"', () => {
    setCustomDimensions(null);
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_CONNEXION, 'non connecté']);
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_ADMIN, 'non admin']);
  });

  it('non-admin user → "connecté" + "non admin"', () => {
    setCustomDimensions({ isZacharieAdmin: false });
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_CONNEXION, 'connecté']);
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_ADMIN, 'non admin']);
  });

  it('admin user → "connecté" + "admin"', () => {
    setCustomDimensions({ isZacharieAdmin: true });
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_CONNEXION, 'connecté']);
    expect(window._paq).toContainEqual(['setCustomDimension', MATOMO_DIMENSION_ADMIN, 'admin']);
  });

  it('creates _paq array when missing', () => {
    vi.stubGlobal('window', {} as any);
    setCustomDimensions(null);
    expect((window as any)._paq).toHaveLength(2);
  });
});

// --- Structural completeness: new routes must appear in the lists above ---

describe('public routes completeness', () => {
  it('App.tsx route paths match known set — update lists above when adding a route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const paths = extractRoutePaths(source).sort();
    const indexCount = countIndexRoutes(source);

    const expectedPaths = [...LANDING_PATHS, ...STANDALONE_PUBLIC_PATHS, ...APP_NON_PUBLIC_PATHS].sort();

    expect(paths).toEqual(expectedPaths);
    expect(indexCount).toBe(1);
  });

  it('connexion-router.tsx route paths match known set — update CONNEXION_LEAF_PATHS when adding a connexion route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/connexion/connexion-router.tsx'), 'utf-8');
    const paths = extractRoutePaths(source).sort();
    const indexCount = countIndexRoutes(source);

    const expectedPaths = ['connexion', ...CONNEXION_LEAF_PATHS].sort();

    expect(paths).toEqual(expectedPaths);
    expect(indexCount).toBe(1);
  });
});
