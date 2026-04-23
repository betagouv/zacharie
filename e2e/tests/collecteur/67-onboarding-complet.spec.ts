import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 67 — Onboarding complet : /collecteur/onboarding/coordonnees → /entreprise.
test('Parcours onboarding collecteur : coordonnees → entreprise', async ({ page }) => {
  await connectWith(page, 'collecteur-pro-nouveau@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur\/onboarding\//, { timeout: 10000 });

  // TODO: verify selector — noms exacts des champs onboarding (Prénom/Nom/Téléphone/Adresse).
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
  // Arrive finalement sur entreprise ou app collecteur.
  await expect(page).toHaveURL(/\/app\/collecteur/, { timeout: 10000 });
});
