import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('ETG_PD_EXAMINATEUR');
});

// Fiche transmise à ETG 1 mais pas encore prise en charge : l'examinateur, aussi premier détenteur,
// peut encore retirer une carcasse. Retirer une carcasse ne change pas l'examen des autres, la vente
// déjà faite doit donc rester affichée sans repasser par « Continuer ».
test('Supprimer une carcasse après transmission laisse la vente affichée', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165243';
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('link', { name: feiId }).first().click();

  const venteOuDon = page.getByRole('heading', { name: 'Vente ou don' });
  await expect(venteOuDon).toBeVisible({ timeout: 10000 });

  const carcasses = page.getByRole('button', { name: /Daim N°/ });
  await expect(carcasses.first()).toBeVisible();
  const initialCount = await carcasses.count();

  const carcasseASupprimer = carcasses.first();
  await carcasseASupprimer.scrollIntoViewIfNeeded();
  await carcasseASupprimer.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer la carcasse' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(carcasses).toHaveCount(initialCount - 1, { timeout: 10000 });

  await expect(
    page.getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' })
  ).toBeVisible();
  await expect(venteOuDon).toBeVisible();
  await expect(page.getByText(/ETG 1/).first()).toBeVisible();
});
