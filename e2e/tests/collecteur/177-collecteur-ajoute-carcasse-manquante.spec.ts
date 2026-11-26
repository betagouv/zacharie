import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 177 — Le collecteur ajoute une carcasse manquante, comme l'ETG (scénario 64) :
// la carcasse apparaît tout de suite dans sa liste, l'examinateur initial signe son examen.
test('Ajout carcasse manquante : collecteur ajoute → examinateur signe → carcasse rejoint la fiche', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-245242';
  const newBracelet = 'MM-ADDED-362';

  // ----- Step 1: le collecteur ajoute la carcasse -------------------------------------------------
  await connectWith(page, 'collecteur-pro@example.fr');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}`));

  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await page.getByLabel('Numéro de marquage *').fill(newBracelet);
  await page.getByLabel('Espèce *').selectOption({ label: 'Chevreuil' });
  await page.getByLabel("Commentaire pour l'examinateur (optionnel)").fill('Trouvée à part du lot');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  await expect(page.getByRole('button', { name: `Chevreuil N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial").first()).toBeVisible();

  // ----- Step 2: l'examinateur initial signe l'examen ---------------------------------------------
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir la modification' }).click();
  await page.getByRole('link', { name: 'Voir la demande' }).first().click();

  await expect(page.getByRole('heading', { name: "Examen initial d'une carcasse ajoutée" })).toBeVisible();
  const sansAnomalieCheckbox = page.getByText('Aucune anomalie constatée');
  await sansAnomalieCheckbox.scrollIntoViewIfNeeded();
  await sansAnomalieCheckbox.check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // ----- Step 3: côté collecteur, la carcasse est un membre signé de la fiche ---------------------
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await expect(page.getByRole('button', { name: `Chevreuil N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial")).toHaveCount(0);
  await expect(page.getByText(/Carcasse ajoutée par/).first()).toBeVisible();
});
