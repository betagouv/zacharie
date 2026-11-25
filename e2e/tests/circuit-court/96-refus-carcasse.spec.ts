import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test('96 - Refuser une carcasse côté circuit court : présence/absence du bouton', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  const carcasseBtn = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  if (await carcasseBtn.isVisible().catch(() => false)) {
    await carcasseBtn.click();
  }

  const refuserBtn = page.getByRole('button', { name: /Carcasse refusée|Refuser/i });
  const count = await refuserBtn.count();
  console.log(`[scenario 96] nombre de boutons Refuser trouvés côté circuit court : ${count}`);
  expect(count).toBe(0);
});
