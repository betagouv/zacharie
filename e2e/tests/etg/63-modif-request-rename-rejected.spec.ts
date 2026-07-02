import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 63 — Examinateur REJECTS a RENAME request.
// The card keeps the old marquage, the history shows a red "Refus du changement…" dot, and the
// CardCarcasse description gains a red warning icon.
test('Rename rejected : examinateur refuse → ETG voit warning sur la carcasse', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  await page.getByRole('button', { name: 'Signaler un numéro de marquage incorrect' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-Z99');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText('Demande de modification du numéro de marquage en cours').first()).toBeVisible({
    timeout: 10000,
  });

  // Examinateur rejects.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await page.getByRole('link', { name: 'Voir et traiter' }).first().click();

  await page.getByLabel('Motif du refus').fill("Non, c'est bien 002");
  await page.getByRole('button', { name: 'Refuser' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // ETG side: pending banner is gone, card description has the warning + "1 modification".
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // The marquage hasn't changed.
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Demande de modification du numéro de marquage en cours')).toHaveCount(0);
  // 1 modification line is visible somewhere on the card.
  await expect(page.getByText('1 modification').first()).toBeVisible();

  // Open the modal — history timeline includes "Refus du changement de numéro" with the motif.
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await expect(page.getByText(/Refus du changement de numéro/).first()).toBeVisible();
  await expect(page.getByText(/Motif du refus.*Non, c'est bien 002/).first()).toBeVisible();
});
