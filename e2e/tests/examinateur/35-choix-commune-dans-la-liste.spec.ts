import { test, expect } from '../../utils/test';
import type { Request, Route } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
  // sans service worker, page.route voit directement la requête d'enregistrement du profil
  serviceWorkers: 'block',
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

const isUserUrl = (url: URL) => /\/user\/[^/?]+$/.test(url.pathname);
const isSaveUserRequest = (request: Request) =>
  request.method() === 'POST' && isUserUrl(new URL(request.url()));

// Scenario 35 — Le formulaire de coordonnées s'enregistre quand le champ perd le focus. Choisir une
// commune dans la liste ne doit pas enregistrer la saisie partielle : sa réponse, arrivée après
// le choix, remplacerait la commune choisie.
test('Coordonnées : la commune choisie dans la liste reste affichée et enregistrée', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/profil/coordonnees');

  const codePostal = page.locator('#code_postal');
  const ville = page.locator('#ville');
  await codePostal.scrollIntoViewIfNeeded();
  await codePostal.fill('');
  await ville.click();
  await ville.fill('Montpel');
  const commune = page.getByRole('button', { name: '34000 MONTPELLIER', exact: true });
  await expect(commune).toBeVisible({ timeout: 10000 });

  // On retient les enregistrements déclenchés par le choix, pour que leur réponse arrive après lui.
  const heldRoutes: Array<Route> = [];
  await page.route(isUserUrl, (route) => {
    if (!isSaveUserRequest(route.request())) return route.continue();
    heldRoutes.push(route);
  });
  await commune.click();
  await expect(ville).toHaveValue('MONTPELLIER');
  await expect(codePostal).toHaveValue('34000');

  const heldResponses = heldRoutes.map((route) =>
    page.waitForResponse((response) => response.request() === route.request())
  );
  for (const route of heldRoutes) {
    await route.continue();
  }
  await Promise.all(heldResponses);
  await page.unroute(isUserUrl);

  await expect(ville).toHaveValue('MONTPELLIER');
  await expect(codePostal).toHaveValue('34000');

  const saved = page.waitForResponse((response) => isSaveUserRequest(response.request()));
  await ville.blur();
  await saved;

  await page.reload();
  await expect(page.locator('#ville')).toHaveValue('MONTPELLIER', { timeout: 10000 });
  await expect(page.locator('#code_postal')).toHaveValue('34000');
});
