import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE_AND_ASSIGNED_TO_SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 66 — ETG adds a missing carcasse AFTER the FEI has already been transmitted to SVI but
// BEFORE the examinateur approves the new exam. The new carcasse must:
//   - inherit the FEI's SVI assignment (svi_assigned_to_fei_at, svi_entity_id, next_owner_*) so the
//     SVI sees it immediately (with the pending banner)
//   - not trigger an endless re-transmission prompt on the ETG side after approval
// Once the examinateur approves, the SVI can finally run IPM on the new carcasse.
test('Ajout carcasse manquante pré-transmission SVI : visible par SVI, pas de boucle ETG', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-235243';
  const newBracelet = 'MM-LATE-99';

  // Step 1: ETG-1 (still has a CarcasseIntermediaire row from the SVI seed) opens the FEI and adds
  // a missing carcasse, even though the FEI has already been transmitted to SVI.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.getByLabel('Numéro de marquage *').fill(newBracelet);
  await page.getByLabel('Espèce *').selectOption({ label: 'Cerf élaphe' });
  await page.getByLabel("Commentaire pour l'examinateur (optionnel)").fill('Trouvée après transmission SVI');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByText('Carcasse ajoutée, approbation de mise sur le marché en attente').first()
  ).toBeVisible();

  // Step 2: SVI opens the same FEI and DOES see the newly added carcasse (with the pending banner
  // — this is the bug-1 regression assertion).
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Cerf élaphe.*${newBracelet}`) })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByText('Carcasse ajoutée, approbation de mise sur le marché en attente').first()
  ).toBeVisible();

  // Step 3: Opening the carcasse inspection page shows the IPM section with the explanatory
  // message — not the IPM form — because the examinateur has not signed yet.
  await page
    .getByRole('button', { name: new RegExp(`Cerf élaphe.*${newBracelet}`) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(
    page
      .getByText(
        "Tant que l'examinateur initial n'a pas fait approuvé la mise sur le marché, il est impossible de réaliser les inspections post-mortem."
      )
      .first()
  ).toBeVisible();

  // Step 4: Examinateur signs the approval.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await page.getByRole('link', { name: 'Voir et traiter' }).first().click();
  await expect(page.getByRole('heading', { name: "Examen initial d'une carcasse ajoutée" })).toBeVisible();
  const sansAnomalieCheckbox = page.getByText('Aucune anomalie constatée');
  await sansAnomalieCheckbox.scrollIntoViewIfNeeded();
  await sansAnomalieCheckbox.check();

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // Step 5: ETG side — the FEI is back at SVI (current owner), no "Transmettre la fiche" CTA on the
  // approved carcasse. The banner is gone.
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Carcasse ajoutée, approbation de mise sur le marché en attente')).toHaveCount(
    0
  );

  // Step 6: SVI sees the carcasse and the IPM1 form is now editable (the blocking message is
  // gone).
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page
    .getByRole('button', { name: new RegExp(`Cerf élaphe.*${newBracelet}`) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(
    page.getByText(
      "Tant que l'examinateur initial n'a pas fait approuvé la mise sur le marché, il est impossible de réaliser les inspections post-mortem."
    )
  ).toHaveCount(0);
});
