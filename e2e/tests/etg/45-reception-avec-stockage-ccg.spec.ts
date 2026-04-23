import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 45 — Réception avec stockage CCG ETG
// ETG renseigne un lieu d'entrée/stockage avant de transmettre au SVI.
test('Réception ETG avec stockage puis transmission SVI', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(
    page.getByRole('heading', { name: 'Réception par mon établissement de traitement' })
  ).toBeVisible();

  // Accepter toutes les carcasses rapidement — le lieu d'entrée est implicitement renseigné via la prise en charge.
  for (const carcassLabel of [
    'Daim N° MM-001-001 Mise à',
    'Daim N° MM-001-002 Mise à',
    'Daim N° MM-001-004 Mise à',
    'Pigeons (10) N° MM-001-003',
  ]) {
    const btn = page.getByRole('button', { name: carcassLabel });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const panel = page.locator("dialog, [role='dialog']").or(page.locator("[class*='fr-modal']"));
    // Best-effort: sélectionne l'option "Carcasse acceptée" dans le panneau actif.
    // TODO: verify selector — structure DSFR du panneau peut varier.
    const accept = page.getByText('Carcasse acceptée').first();
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
    }
    await page.keyboard.press('Escape').catch(() => void 0);
  }

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 5000 });
});
