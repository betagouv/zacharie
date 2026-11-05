import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE_PD_HORS_LIGNE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Le premier détenteur de cette fiche a été désigné hors ligne (`premier_detenteur_offline: true` sur la
// fiche et sur ses carcasses). Une carcasse ajoutée par l'ETG doit reprendre cette valeur : sinon elle
// diffère des autres carcasses de la transmission et `capture('Transmssion differs from one of the
// carcasses')` se déclenche, ce que la garde de `utils/test.ts` fait échouer.
test("Ajout d'une carcasse manquante sur une fiche dont le premier détenteur a été désigné hors ligne", async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';
  const newBracelet = 'MM-ADDED-98';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await page.getByLabel('Numéro de marquage *').fill(newBracelet);
  await page.getByLabel('Espèce *').selectOption({ label: 'Cerf élaphe' });
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial").first()).toBeVisible();
});
