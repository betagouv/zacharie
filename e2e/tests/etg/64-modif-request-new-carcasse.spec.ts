import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Ajout carcasse manquante : ETG ajoute → examinateur signe → carcasse rejoint la fiche', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';
  const newBracelet = 'MM-ADDED-99';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await page.getByLabel('Numéro de marquage *').fill(newBracelet);
  await page.getByLabel('Espèce *').selectOption({ label: 'Cerf élaphe' });
  await page.getByLabel("Commentaire pour l'examinateur (optionnel)").fill('Trouvée à part du lot');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial").first()).toBeVisible();
  await expect(page.getByText(/Carcasse ajoutée par/).first()).toBeVisible();

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

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial")).toHaveCount(0);
  await expect(page.getByText(/Carcasse ajoutée par/).first()).toBeVisible();
});
