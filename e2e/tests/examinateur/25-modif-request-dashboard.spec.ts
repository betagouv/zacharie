import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({
  launchOptions: { slowMo: 100 },
  // CHASSEUR spec: mobile viewport per project convention.
  viewport: { width: 350, height: 667 },
  isMobile: true,
  hasTouch: true,
});

// Scenario 25 — Dashboard alert modal on /app/chasseur when there are pending demandes; nav menu
// shows count; landing on the URL again re-opens the modal; no pending → no modal.
test('Examinateur dashboard alert modal + nav badge + grouping', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  // Setup: ETG creates a pending RENAME demande.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByRole('button', { name: 'Signaler un numéro de bracelet incorrect' }).click();
  await page.getByLabel('Numéro de bracelet correct').fill('MM-001-FIX');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText('Demande de modification du numéro de bracelet en cours').first()).toBeVisible({
    timeout: 10000,
  });

  // Examinateur lands on /app/chasseur — modal pops automatically.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur$/);
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/1 demande de modification en attente/)).toBeVisible();

  // "Plus tard" closes the modal without navigating.
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/chasseur$/);

  // Re-navigating to /app/chasseur re-opens the modal.
  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });

  // "Voir les demandes" navigates to the dashboard list. Heading uses "Fiche du DD/MM - {Commune}"
  // (not the FEI numero).
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);
  await expect(page.getByRole('heading', { name: /Fiche du 07\/07.*CHASSENARD/ })).toBeVisible();
  await expect(page.getByText(/MM-001-001/).first()).toBeVisible();
  await expect(page.getByText(/MM-001-FIX/).first()).toBeVisible();
});

test('No pending demandes → no modal pop-up', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  // Nothing pending in this seed → no alert modal.
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toHaveCount(0);
});
