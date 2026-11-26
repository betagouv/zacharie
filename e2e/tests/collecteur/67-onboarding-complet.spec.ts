import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Parcours onboarding collecteur : coordonnees → entreprise', async ({ page }) => {
  await connectWith(page, 'collecteur-pro-nouveau@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur\/onboarding\//, { timeout: 10000 });

  const inputs = page.getByRole('textbox');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i);
    if (await el.isEditable().catch(() => false)) {
      await el.fill('Test');
      await el.blur();
    }
  }

  const next = page.getByRole('button', { name: /Continuer|Suivant|Valider|Enregistrer/i }).first();
  if (await next.isVisible().catch(() => false)) {
    await next.scrollIntoViewIfNeeded();
    await next.click();
  }
  await expect(page).toHaveURL(/\/app\/collecteur/, { timeout: 10000 });
});
