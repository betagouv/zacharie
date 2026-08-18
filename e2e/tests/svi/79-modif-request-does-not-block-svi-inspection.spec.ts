import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE_AND_ASSIGNED_TO_SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 79 — Une demande de modification est indicative : la correction du marquage est appliquée
// tout de suite (sans l'examinateur) et le SVI peut inspecter alors que la demande est encore PENDING.
test('SVI can still inspect when a pending modif exists on the carcasse', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235243';

  // Step 1: ETG-1 (still has CarcasseIntermediaire row from the SVI seed) corrects a wrong marquage.
  // Le renommage est immédiat : la carte porte le nouveau numéro sans aucune action de l'examinateur.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await page.getByRole('button', { name: 'Corriger le numéro de marquage' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-NEW');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-NEW Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);

  // Step 2: SVI logs in. The informative banner is attached to the carcasse on the inspection list,
  // sous le nouveau numéro.
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const sviCard = page.getByRole('button', { name: /Daim.*MM-001-NEW/ }).first();
  await expect(sviCard).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible();

  // Step 3: la demande est toujours PENDING et le SVI enregistre pourtant une IPM1 complète
  // (acceptation en un clic depuis la fiche). C'est l'assertion qui casserait si le blocage revenait.
  const accepterBtn = sviCard.getByRole('button', { name: 'Accepter' });
  await accepterBtn.scrollIntoViewIfNeeded();
  const syncResponse = page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
  await accepterBtn.click();
  await expect(sviCard.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({ timeout: 10000 });
  await syncResponse;

  // Step 4: la page d'inspection reste utilisable et la bannière informative y est toujours affichée.
  await page
    .getByRole('button', { name: /Daim.*MM-001-NEW/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText('Inspection Post-Mortem 1 (IPM1)').first()).toBeVisible();
  await expect(page.getByText("Carcasse présentée à l'inspection").first()).toBeVisible();
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible();

  // Step 5: reconnexion — la décision a bien été persistée côté serveur malgré la demande en cours.
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(
    page
      .getByRole('button', { name: /Daim.*MM-001-NEW/ })
      .first()
      .getByText(/Décision IPM1 : Acceptée/)
  ).toBeVisible({ timeout: 10000 });
});
