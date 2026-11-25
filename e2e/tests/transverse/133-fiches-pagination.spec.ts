import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('CHASSEUR_MANY_FICHES');
});

test('Pagination des fiches chasseur : la page 2 affiche d’autres fiches que la page 1', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const feiLinks = page.locator('a[href*="/app/chasseur/fei/ZACH-"]');

  await expect(feiLinks).toHaveCount(3, { timeout: 15000 });
  const page1Hrefs = await feiLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

  const page2Link = page.locator('a[title="Page 2"]');
  await expect(page2Link).toBeVisible();

  await page2Link.click();
  await expect(page).toHaveURL(/[?&]page=2/);

  await expect(feiLinks).toHaveCount(2, { timeout: 10000 });
  const page2Hrefs = await feiLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

  for (const href of page2Hrefs) {
    expect(page1Hrefs).not.toContain(href);
  }
});
