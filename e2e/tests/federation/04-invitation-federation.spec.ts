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

test("Chasseur non membre d'une fédération : aucune fédération affichée", async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/ma-federation');
  await expect(page.getByRole('heading', { level: 1, name: 'Ma fédération' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#federation-title')).toHaveCount(0);
});

test('Chasseur admin de sa FDC : invite un collègue depuis ses réglages', async ({ page }) => {
  await connectWith(page, 'fdc@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/ma-federation');
  await expect(page.getByRole('heading', { name: 'Ma fédération : FDC Allier (03)' })).toBeVisible({
    timeout: 10000,
  });

  const invite = page.getByLabel('Inviter un collègue par email');
  await invite.scrollIntoViewIfNeeded();
  await invite.fill('directeur-fdc@example.fr');
  const inviteResponse = page.waitForResponse(
    (res) => res.url().includes('/user/invite-user') && res.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Inviter' }).click();
  expect((await inviteResponse).ok()).toBe(true);

  await expect(page.getByText('directeur-fdc@example.fr')).toBeVisible({ timeout: 10000 });
});
