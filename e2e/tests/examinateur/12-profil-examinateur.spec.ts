import { test, expect } from '@playwright/test';
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

test('Profil examinateur : modifier coordonnées + formation persistées après reload', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/profil/coordonnees');

  const tel = page.getByRole('textbox', { name: /Téléphone/i });
  await tel.scrollIntoViewIfNeeded();
  await tel.fill('0612345678');
  await tel.blur();

  const saveBtn = page.getByRole('button', { name: /Enregistrer|Sauver/i }).first();
  if (await saveBtn.count()) {
    await saveBtn.click();
  }

  await page.reload();
  await expect(page.getByRole('textbox', { name: /Téléphone/i })).toHaveValue('0612345678');
});
