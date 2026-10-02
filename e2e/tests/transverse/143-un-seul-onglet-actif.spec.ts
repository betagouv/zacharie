import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 143 — Un seul onglet actif à la fois (verrou Web Locks).
// Un second onglet affiche l'écran de blocage ; « Utiliser cet onglet » lui donne la main
// et l'ancien onglet se recharge sur l'écran de blocage.

const feiId = 'ZACH-20250707-QZ6E0-165242';
const blockedTitle = 'Zacharie est déjà ouvert dans un autre onglet';

test.beforeEach(async () => {
  await resetDb('ETG');
});

async function expectDashboard(page: Page) {
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: blockedTitle })).toHaveCount(0);
}

async function expectBlocked(page: Page) {
  // l'onglet sans verrou attend jusqu'à 2 s avant d'afficher l'écran de blocage
  await expect(page.getByRole('heading', { name: blockedTitle })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Fermez cet onglet ou utilisez l'autre.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Utiliser cet onglet' })).toBeVisible();
  await expect(page.getByRole('link', { name: feiId })).toHaveCount(0);
}

test('Un second onglet est bloqué puis reprend la main avec « Utiliser cet onglet »', async ({
  page,
  context,
}) => {
  await connectWith(page, 'etg-1@example.fr');
  await expectDashboard(page);

  const page2 = await context.newPage();
  await page2.goto('http://localhost:3290/app/etg');
  await expectBlocked(page2);
  // le premier onglet reste utilisable
  await expectDashboard(page);

  await page2.getByRole('button', { name: 'Utiliser cet onglet' }).click();
  await expectDashboard(page2);
  await expectBlocked(page);
});

test("Après fermeture de l'onglet actif, l'autre onglet reprend la main", async ({ page, context }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expectDashboard(page);

  const page2 = await context.newPage();
  await page2.goto('http://localhost:3290/app/etg');
  await expectBlocked(page2);

  await page.close();
  await page2.getByRole('button', { name: 'Utiliser cet onglet' }).click();
  await expectDashboard(page2);
});
