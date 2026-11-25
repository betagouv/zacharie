import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('CCG : création depuis profil → visible après reload', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  await expect(page.getByText(/Chambres froides/i).first()).toBeVisible({ timeout: 10000 });

  const ouiAvecNumero = page.getByText(/Oui.*chambre froide.*numéro/).first();
  await ouiAvecNumero.scrollIntoViewIfNeeded();
  await ouiAvecNumero.click();

  await page.getByRole('textbox', { name: /Numéro d'identification/ }).fill('CCG-01');

  await page.getByRole('button', { name: 'Ajouter cette chambre froide' }).click();

  await expect(page.getByText(/CCG Chasseurs|CCG-01/).first()).toBeVisible({ timeout: 10000 });
});
