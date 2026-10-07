import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 148 — Nouvelle version proposée.
// Web : un chunk introuvable (vite:preloadError) affiche un toast avec un bouton « Recharger » qui
// recharge la page. App mobile (WebView Expo) : le toast demande de rouvrir l'application, sans bouton.
test('web : le toast propose de recharger et le bouton recharge la page', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  // Repère posé dans la page courante : il disparaît si la page est rechargée.
  await page.evaluate(() => {
    (window as unknown as { __avantRechargement?: boolean }).__avantRechargement = true;
  });

  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));

  await expect(page.getByText('Une nouvelle version de Zacharie est disponible.')).toBeVisible({
    timeout: 10000,
  });
  const reloadButton = page.getByRole('button', { name: 'Recharger', exact: true });
  await expect(reloadButton).toBeVisible();

  const reloaded = page.waitForEvent('load');
  await reloadButton.click();
  await reloaded;

  expect(
    await page.evaluate(() => (window as unknown as { __avantRechargement?: boolean }).__avantRechargement)
  ).toBeUndefined();
  await expect(page).toHaveURL(/\/app\/etg/);
  await expect(page.getByText('Une nouvelle version de Zacharie est disponible.')).toBeHidden();
});

test("app mobile : le toast demande de rouvrir l'application, sans bouton Recharger", async ({ page }) => {
  // Simule la WebView Expo avant le chargement de l'app.
  await page.addInitScript(() => {
    (window as unknown as { ReactNativeWebView: { postMessage: () => void } }).ReactNativeWebView = {
      postMessage() {},
    };
  });
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  // Envoyé par l'app mobile quand une nouvelle version a été téléchargée.
  await page.evaluate(() => window.dispatchEvent(new Event('zacharie-new-native-bundle')));

  await expect(
    page.getByText(
      "Une nouvelle version de Zacharie est disponible. Fermez puis rouvrez l'application pour l'utiliser."
    )
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /Recharger/ })).toHaveCount(0);
});
