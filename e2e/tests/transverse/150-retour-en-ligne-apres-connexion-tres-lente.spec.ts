import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.setTimeout(120_000);

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test("L'application repasse en ligne d'elle-même après une connexion très lente", async ({ page }) => {
  const initialLoadDone = page.waitForResponse((response) => response.url().includes('/carcasse?'));
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await initialLoadDone;

  const offlineBanner = page.getByText("Vous n'avez pas internet, ou votre connexion est très mauvaise.");
  await expect(offlineBanner).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event('very-bad-connection')));
  await expect(offlineBanner).toBeVisible();

  await expect(offlineBanner).toBeHidden({ timeout: 45_000 });
});
