import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 114 — Chain dispatch hybride : PD dispatche ETG + collecteur → chacun continue → SVI recoit les deux.
test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch PD → ETG 1 + Collecteur Pro 1 puis chacun → SVI', async ({ page }) => {
  test.setTimeout(180_000);
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD dispatche en 2 groupes
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Groupe 1 : ETG 1
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Ajouter groupe 2
  // Groupe 2 : Collecteur Pro 1
  // No transport step when dispatching to a collecteur — they handle transport
  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i, carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 recoit sa branche
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });

  // 3. Collecteur Pro 1 recoit sa branche
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
