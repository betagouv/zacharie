import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG');
});

// Scenario 70 — Paramètres > Entreprise : le n° de bon de réception n'est demandé à la prise
// en charge que si l'entreprise a activé le réglage (activé pour ETG 1 dans le seed).
test('70 - ETG active ou désactive la demande du n° de bon de réception', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  const reglageLabel = /Demander le n° de bon de réception/i;

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page.getByRole('heading', { name: 'Renseignez votre entreprise' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('checkbox', { name: reglageLabel })).toBeChecked();

  await page.getByRole('checkbox', { name: reglageLabel }).click({ force: true });
  await expect(page.getByText('Réglage enregistré')).toBeVisible({ timeout: 10000 });

  // réglage désactivé : plus de champ à la prise en charge
  await page.goto('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('N° de bon de réception')).toHaveCount(0);

  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page.getByRole('checkbox', { name: reglageLabel })).not.toBeChecked();
  await page.getByRole('checkbox', { name: reglageLabel }).click({ force: true });
  await expect(page.getByText('Réglage enregistré')).toBeVisible({ timeout: 10000 });

  // réglage réactivé : le champ est de nouveau demandé
  await page.goto('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));
  await expect(page.getByLabel('N° de bon de réception')).toBeVisible({ timeout: 10000 });
});
