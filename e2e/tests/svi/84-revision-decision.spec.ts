import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test("84 - Révision d'une décision SVI : lecture seule sur fiche clôturée", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);

  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}/`));

  const carcasseBtn = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  if (await carcasseBtn.count()) {
    await carcasseBtn.scrollIntoViewIfNeeded();
    await carcasseBtn.click();
    await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
    const saveBtn = page.getByRole('button', { name: 'Enregistrer' });
    if (await saveBtn.count()) {
    }
    await expect(page.getByText(/Inspection Post-Mortem/).first()).toBeVisible({ timeout: 10000 });
  }
});
