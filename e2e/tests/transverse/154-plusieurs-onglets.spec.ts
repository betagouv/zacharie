import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 154 — Zacharie dans plusieurs onglets.
// En ligne, chaque onglet recharge ses données quand on revient dessus, et une déconnexion dans un
// onglet déconnecte les autres. Hors ligne, seul le premier onglet utilisé fonctionne.

const feiId = 'ZACH-20250707-QZ6E0-165242';
const blockedTitle = "Hors ligne, Zacharr'ête de fonctionner sur plusieurs onglets";

test.beforeEach(async () => {
  await resetDb('ETG');
});

async function expectDashboard(page: Page) {
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
}

async function openSecondTab(page: Page) {
  const page2 = await page.context().newPage();
  await page2.goto('http://localhost:3290/app/etg');
  await expectDashboard(page2);
  return page2;
}

test('Revenir sur un onglet recharge ses données depuis le serveur', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expectDashboard(page);
  const page2 = await openSecondTab(page);

  const carcassesRequest = page2.waitForRequest((request) =>
    request.url().startsWith('http://localhost:3291/carcasse')
  );
  await page2.evaluate(() => window.dispatchEvent(new Event('focus')));
  await carcassesRequest;
});

test("Une déconnexion dans un onglet déconnecte l'autre onglet", async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expectDashboard(page);
  const page2 = await openSecondTab(page);

  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 10000 });
  await expect(page2).toHaveURL(/\/app\/connexion/, { timeout: 10000 });
  await expect(page2.getByRole('link', { name: feiId })).toHaveCount(0);
});

test('Hors ligne, le second onglet utilisé est bloqué jusqu’au retour en ligne', async ({
  page,
  context,
}) => {
  await connectWith(page, 'etg-1@example.fr');
  await expectDashboard(page);
  const page2 = await openSecondTab(page);

  await context.setOffline(true);
  // le premier onglet utilisé hors ligne prend la main
  await page.keyboard.press('Shift');
  await page2.keyboard.press('Shift');

  await expect(page2.getByRole('heading', { name: blockedTitle })).toBeVisible({ timeout: 10000 });
  await expect(page2.getByText("Vous ne pouvez en utiliser qu'un seul.")).toBeVisible();
  await expect(page2.getByRole('link', { name: feiId })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: blockedTitle })).toHaveCount(0);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();

  await context.setOffline(false);
  await expect(page2.getByRole('heading', { name: blockedTitle })).toHaveCount(0, { timeout: 10000 });
  await expectDashboard(page2);
});
