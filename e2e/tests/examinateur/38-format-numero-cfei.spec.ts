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

test('Profil examinateur : un numéro CFEI hors format affiche un avertissement, sans bloquer', async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('/app/chasseur/profil/informations-de-chasse');

  const avertissement = page.getByText(
    'Ce numéro ne correspond pas au format attendu (ex. CFEI-075-25-001). Vérifiez-le sur votre attestation.',
    { exact: true }
  );
  const numeroCfei = page.locator('#numero_cfei');
  await numeroCfei.scrollIntoViewIfNeeded();
  // Numéro du seed (CFEI-075-25-001) : au bon format
  await expect(numeroCfei).toHaveValue('CFEI-075-25-001');
  await expect(avertissement).toBeHidden();

  await numeroCfei.fill('123');
  await expect(avertissement).toBeVisible();

  // Le numéro hors format est quand même enregistré
  const enregistrement = page.waitForResponse(
    (response) => response.url().includes('/user/') && response.request().method() === 'POST' && response.ok()
  );
  await numeroCfei.blur();
  await enregistrement;
  await page.reload();
  await expect(page.locator('#numero_cfei')).toHaveValue('123', { timeout: 10000 });
  await expect(avertissement).toBeVisible();

  await page.locator('#numero_cfei').fill('cfei-075-25-002');
  await expect(avertissement).toBeHidden();
});
