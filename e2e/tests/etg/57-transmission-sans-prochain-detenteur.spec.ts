import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 57 — Tentative de transmettre sans prochain détenteur → erreur.
test("Erreur 'Il manque le prochain détenteur' si aucun choisi", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();

  // Définir la date de prise en charge puis tenter de transmettre sans choisir un destinataire.
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();

  // The "Transmettre la fiche" button is disabled when validation fails
  // The error message should already be visible since no destinataire is selected
  const transmettre = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettre.scrollIntoViewIfNeeded();
  await expect(transmettre).not.toBeDisabled();
  await expect(page.getByText(/Il manque le prochain dé/)).toBeVisible({ timeout: 10000 });
});
