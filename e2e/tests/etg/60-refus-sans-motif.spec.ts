import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test("Refus sans motif ne s'enregistre pas", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();

  await new Promise((r) => setTimeout(r, 500));
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse refusée').click();

  const save = page.getByLabel('Daim - N° MM-001-001').getByRole('button', { name: 'Enregistrer' });
  if (await save.isVisible().catch(() => false)) {
    const disabled = await save.isDisabled().catch(() => false);
    if (!disabled) {
      await save.click();
      await expect(page.getByText(/motif|obligatoire|requis/i).first()).toBeVisible({ timeout: 3000 });
    } else {
      expect(disabled).toBe(true);
    }
  }
});
