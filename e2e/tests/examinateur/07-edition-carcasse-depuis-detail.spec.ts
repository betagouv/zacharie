import { test, expect } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Edition carcasse depuis /chasseur/carcasse/:fei/:id', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  // Crée une fiche minimale avec 1 carcasse
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: 'Utiliser' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Ouvrir détail carcasse
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();

  // Ajouter une anomalie abats via référentiel
  const ajouterAbats = page.getByRole('button', {
    name: 'Ajouter depuis le référentiel des anomalies abats',
  });
  await ajouterAbats.scrollIntoViewIfNeeded();
  await ajouterAbats.click();

  // Expand category then select anomaly
  await page.getByText('Appareil respiratoire (sinus/trachée/poumon)').click();
  await page.getByText('Abcès ou nodules').first().click();

  // Close the modal
  await page.getByRole('button', { name: 'Fermer' }).last().click();

  // Go back to fiche
  const retourBtn = page.getByRole('button', { name: 'Enregistrer et retourner à la fiche' });
  await retourBtn.scrollIntoViewIfNeeded();
  await retourBtn.click();

  // Verify anomaly persisted — click into detail to check
  const carcasseBtn = page.getByRole('button', { name: /Daim N°/ }).first();
  await expect(carcasseBtn).toBeVisible({ timeout: 10000 });
  await carcasseBtn.click();
  await page.getByRole('button', { name: '⬇️ Anomalies' }).click();
  await page
    .locator(
      '.mt-4 > .fr-input-group > .mt-2 > .input-for-search-prefilled-data__control > .input-for-search-prefilled-data__value-container > .input-for-search-prefilled-data__input-container'
    )
    .click();
  await page
    .getByRole('option', { name: 'Abcès ou nodules Unique - Appareil respiratoire (sinus/trachée/poumon)' })
    .click();
  // On the detail page, scroll down to find the anomaly section
  const anomalyText = page.getByText(/Abcès ou nodules/i);
  await anomalyText.scrollIntoViewIfNeeded();
  await expect(anomalyText).toBeVisible({ timeout: 10000 });
});
