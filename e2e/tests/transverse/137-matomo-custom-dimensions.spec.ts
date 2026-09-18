import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

const PUBLIC_ROUTES = [
  '/',
  '/pros',
  '/demarches',
  '/test-sentry',
  '/mentions-legales',
  '/accessibilite',
  '/politique-de-confidentialite',
  '/modalites-d-utilisation',
  '/stats',
  '/stats/matrice-impact',
  '/contact',
  '/faq',
  '/quiz',
  '/quiz/tv',
  '/app/connexion',
  '/app/connexion/creation-de-compte',
  '/app/connexion/invitation',
  '/app/connexion/mot-de-passe-oublie',
  '/app/connexion/reset-mot-de-passe',
];

test.beforeAll(async () => {
  await resetDb();
});

async function waitForCustomDimension(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Array.isArray((window as any)._paq) &&
      (window as any)._paq.some((e: any[]) => e[0] === 'setCustomDimension'),
    { timeout: 10000 }
  );
}

async function getLastCustomDimension(page: Page, dimensionId: number): Promise<string | null> {
  return page.evaluate((id) => {
    const paq = (window as any)._paq;
    if (!Array.isArray(paq)) return null;
    const entries = paq.filter((e: any[]) => e[0] === 'setCustomDimension' && e[1] === id);
    return entries.length > 0 ? entries[entries.length - 1][2] : null;
  }, dimensionId);
}

test('public pages (logged out): custom dimension "non connecté" + "non admin"', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await waitForCustomDimension(page);

    const connexion = await getLastCustomDimension(page, 1);
    const admin = await getLastCustomDimension(page, 2);

    expect.soft(connexion, `${route}: expected "non connecté"`).toBe('non connecté');
    expect.soft(admin, `${route}: expected "non admin"`).toBe('non admin');
  }
});

test('logged-in non-admin: custom dimension "connecté" + "non admin"', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await waitForCustomDimension(page);

  const connexion = await getLastCustomDimension(page, 1);
  const admin = await getLastCustomDimension(page, 2);

  expect(connexion).toBe('connecté');
  expect(admin).toBe('non admin');
});

test('logged-in admin: custom dimension "connecté" + "admin"', async ({ page }) => {
  await connectWith(page, 'admin@example.fr');
  await waitForCustomDimension(page);

  const connexion = await getLastCustomDimension(page, 1);
  const admin = await getLastCustomDimension(page, 2);

  expect(connexion).toBe('connecté');
  expect(admin).toBe('admin');
});
