import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 64 — Modification request NEW_CARCASSE, full multi-actor.
// ETG adds a missing carcasse with the "Ajouter une carcasse manquante" button → the carcasse
// appears in the main intermediaire list (NOT in "Carcasses déjà refusées") with a pending banner →
// examinateur fills the sanitary exam form and signs → the carcasse joins the FEI as a signed
// (`examinateur_signed_at`) row.
test('Ajout carcasse manquante : ETG ajoute → examinateur signe → carcasse rejoint la fiche', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';
  const newBracelet = 'MM-ADDED-99';

  // ETG side: add a missing carcasse.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await page.getByLabel('Numéro de bracelet *').fill(newBracelet);
  await page.getByLabel('Espèce *').selectOption({ label: 'Cerf élaphe' });
  await page.getByLabel("Commentaire pour l'examinateur (optionnel)").fill('Trouvée à part du lot');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  // The carcasse appears in the main list immediately, with the pending banner attached.
  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByText('Carcasse ajoutée, approbation de mise sur le marché en attente').first()
  ).toBeVisible();

  // Examinateur signs.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await page.getByRole('link', { name: 'Voir et traiter' }).first().click();

  await expect(page.getByRole('heading', { name: "Examen initial d'une carcasse ajoutée" })).toBeVisible();
  // Approve mise sur le marché is pre-checked. Approve "sans anomalie" then sign.
  await page.getByLabel('Aucune anomalie constatée').check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // ETG side: banner gone, the carcasse is now a signed regular member of the FEI.
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Carcasse ajoutée, approbation de mise sur le marché en attente')).toHaveCount(
    0
  );
});
