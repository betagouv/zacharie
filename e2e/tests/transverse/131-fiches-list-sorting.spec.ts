import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('CHASSEUR_MULTI_STATUS');
});

test('Fiches list orders À compléter > En cours > Clôturée', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');

  await page.goto('http://localhost:3290/app/chasseur/fiches');

  const feiLinks = page.locator('a[href*="/app/chasseur/fei/ZACH-"]');
  await expect(feiLinks).toHaveCount(3, { timeout: 15000 });

  const statusBadges = page.locator('span').filter({ hasText: /^(À compléter|En cours|Clôturée)$/ });
  await expect(statusBadges).toHaveCount(3, { timeout: 5000 });

  const texts = await statusBadges.allTextContents();
  expect(texts).toEqual(['À compléter', 'En cours', 'Clôturée']);
});
