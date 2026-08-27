import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE_AND_ASSIGNED_TO_SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 66 — ETG adds a missing carcasse AFTER the FEI has already been transmitted to SVI.
// La demande est indicative : la carcasse doit
//   - hériter de l'assignation SVI de la fiche (svi_assigned_at, svi_entity_id, next_owner_*)
//   - être inspectable par le SVI AVANT que l'examinateur ne signe son examen initial
//   - ne pas déclencher de boucle de re-transmission côté ETG
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
  await expect(page.getByText("Carcasse ajoutée après l'examen initial").first()).toBeVisible();

  // Step 2: SVI opens the same FEI and DOES see the newly added carcasse, avec la bannière
  // informative ET le bouton d'acceptation (il ne s'affiche que si svi_carcasse_status vaut
  // SANS_DECISION : la carcasse ajoutée doit démarrer dans le même état que les autres).
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const sviCard = page.getByRole('button', { name: new RegExp(`Cerf élaphe.*${newBracelet}`) }).first();
  await expect(sviCard).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial").first()).toBeVisible();

  // Step 3: le SVI inspecte AVANT que l'examinateur n'ait signé quoi que ce soit.
  const accepterBtn = sviCard.getByRole('button', { name: 'Accepter' });
  await accepterBtn.scrollIntoViewIfNeeded();
  const syncResponse = page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
  await accepterBtn.click();
  await expect(sviCard.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({ timeout: 10000 });
  await syncResponse;

  // Step 4: l'examinateur signe l'examen initial après coup — le refus n'était pas un préalable.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await page.getByRole('link', { name: 'Voir la demande' }).first().click();
  await expect(page.getByRole('heading', { name: "Examen initial d'une carcasse ajoutée" })).toBeVisible();
  const sansAnomalieCheckbox = page.getByText('Aucune anomalie constatée');
  await sansAnomalieCheckbox.scrollIntoViewIfNeeded();
  await sansAnomalieCheckbox.check();

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // Step 5: ETG side — la carcasse est toujours là, la bannière a disparu, et aucune CTA de
  // re-transmission n'apparaît (la fiche appartient au SVI).
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: `Cerf élaphe N° ${newBracelet}` })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Carcasse ajoutée après l'examen initial")).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Transmettre la fiche' })).toHaveCount(0);

  // Step 6: SVI — la décision prise avant la signature est toujours là après re-sync.
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(
    page
      .getByRole('button', { name: new RegExp(`Cerf élaphe.*${newBracelet}`) })
      .first()
      .getByText(/Décision IPM1 : Acceptée/)
  ).toBeVisible({ timeout: 10000 });
});
