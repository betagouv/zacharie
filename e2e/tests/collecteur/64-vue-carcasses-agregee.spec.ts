import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 64 — Vue /collecteur/carcasses : toutes carcasses passées listées.
test.skip('Collecteur voit ses carcasses dans la vue agrégée', async ({ page }) => {
  // SKIP: COLLECTEUR_PRO seed has no CarcasseIntermediaire — carcasses view shows 0. Need seed with taken-charge carcasses.
  await connectWith(page, 'collecteur-pro@example.fr');
  await page.goto('http://localhost:3290/app/collecteur/carcasses');
  await expect(page).toHaveURL(/\/app\/collecteur\/carcasses/);

  for (const id of ['MM-001-001', 'MM-001-002', 'MM-001-003', 'MM-001-004']) {
    await expect(page.getByText(id).first()).toBeVisible({ timeout: 10000 });
  }
});
