import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE_AND_ASSIGNED_TO_SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 79 — A pending modif request blocks SVI inspection (rule Q1 = c, hard block).
// We need to inject a pending request from another role first. We do that by simulating ETG
// signaling an incorrect marquage for one of the carcasses already assigned to SVI in the SVI seed.
// Then the SVI logs in and sees:
//   - PendingModificationBanner on the carcasse in the list
//   - On the carcasse inspection page, IPM1/IPM2 sections shown but with a message explaining the
//     inspections cannot be carried out yet (the IPM forms themselves are not rendered).
test('SVI canEdit blocked when a pending modif exists on the carcasse', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235243';

  // Step 1: ETG-1 (still has CarcasseIntermediaire row from the SVI seed) signals a wrong marquage.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await page.getByRole('button', { name: 'Signaler un numéro de marquage incorrect' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-NEW');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText('Demande de modification du numéro de marquage en cours').first()).toBeVisible({
    timeout: 10000,
  });

  // Step 2: SVI logs in. The pending banner is attached to the carcasse on the inspection list.
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Demande de modification du numéro de marquage en cours').first()).toBeVisible({
    timeout: 10000,
  });

  // Step 3: opening the carcasse inspection page — IPM1/IPM2 section headers ARE rendered, but
  // the inspection forms are replaced by an explanatory message.
  await page
    .getByRole('button', { name: /Daim.*MM-001-001/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText('Inspection Post-Mortem 1 (IPM1)').first()).toBeVisible();
  await expect(page.getByText('Inspection Post-Mortem 2 (IPM2)').first()).toBeVisible();
  await expect(
    page.getByText(
      "Tant que l'examinateur initial n'a pas fait approuvé la mise sur le marché, il est impossible de réaliser les inspections post-mortem."
    )
  ).toHaveCount(2);
  // The pending banner is shown on the inspection detail page too.
  await expect(
    page.getByText('Demande de modification du numéro de marquage en cours').first()
  ).toBeVisible();
});
