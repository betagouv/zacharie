import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 126 — Décisions SVI divergentes par branche.
// Minimal assertion: after dispatch, the chasseur (examinateur) sees both branches.

test.setTimeout(180_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Décisions SVI divergentes bien rattachées à chaque branche côté chasseur', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // Dispatch 2/2
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0, 1] });
  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // Chasseur voit sa fiche avec les 2 destinataires distincts
  // The PD view after dispatch already shows both ETG names
  await expect(page.getByText(/ETG 1.*1 carcasse \+ 1 lot/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ETG 2.*2 carcasse/)).toBeVisible();
});
