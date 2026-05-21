import { test, expect, type Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

async function gotoStep3MesInformationsDeChasse(page: Page) {
  // Étape 1 : coordonnées
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-coordonnees/);
  await page.locator('#nom_de_famille').fill('Dupont');
  await page.locator('#nom_de_famille').blur();
  await page.locator('#prenom').fill('Jean');
  await page.locator('#prenom').blur();
  await page.locator('#telephone').fill('0600000000');
  await page.locator('#telephone').blur();
  await page.locator('#addresse_ligne_1').fill('1 rue du Test');
  await page.locator('#addresse_ligne_1').blur();
  await page.locator('#code_postal').fill('75000');
  await page.locator('#code_postal').blur();
  await page.locator('#ville').fill('Paris');
  await page.locator('#ville').blur();
  await page.getByRole('button', { name: /Enregistrer et continuer/i }).click();

  // Étape 2 : formation
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/formation-examen-initial/);
  await page.locator('label.fr-label:has-text("Oui")').first().click();
  await page.locator('#numero_cfei').fill('CFEI-075-25-999');
  await page.locator('#numero_cfei').blur();
  await page.getByRole('button', { name: /Enregistrer et continuer/i }).click();

  // Étape 3 : infos de chasse — asso form not yet opened (user.checked_has_asso_de_chasse null)
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-informations-de-chasse/);
}

// Scenario 44a — Onboarding step 3 / Asso : rechercher et sélectionner une entité existante (seed: "Association de chasseurs")
test("44a - Onboarding asso : recherche et sélection d'une entité existante", async ({ page }) => {
  await connectWith(page, 'examinateur-onboarding@example.fr');
  await gotoStep3MesInformationsDeChasse(page);

  // "Êtes-vous rattaché à une association / société / domaine de chasse ?" — clicking Oui reveals the search form
  await page.locator('label.fr-label:has-text("Oui")').first().click();
  await expect(page.getByText(/Rechercher une association, société ou domaine de chasse/i)).toBeVisible({
    timeout: 5000,
  });

  // Open SelectCustom for raison_sociale and pick the seeded entity
  await page.locator("[class*='raison_sociale'][class*='input-container']").first().click();
  await page.getByRole('option', { name: /Association de chasseurs/i }).click();

  // Preview card + "Me rattacher à cette entité" button appear
  const attachBtn = page.getByRole('button', { name: /Me rattacher à cette entité/i });
  await expect(attachBtn).toBeVisible({ timeout: 5000 });
  await attachBtn.scrollIntoViewIfNeeded();
  await attachBtn.click();

  // After attachment the form closes and the relation appears in the list
  await expect(page.getByRole('button', { name: /Me rattacher à une autre entité/i })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/Association de chasseurs/i).first()).toBeVisible({ timeout: 10000 });
});

// Scenario 44b — Onboarding step 3 / Asso : créer une nouvelle association via le formulaire complet
test("44b - Onboarding asso : création d'une nouvelle association via le formulaire", async ({ page }) => {
  await connectWith(page, 'examinateur-onboarding@example.fr');
  await gotoStep3MesInformationsDeChasse(page);

  await page.locator('label.fr-label:has-text("Oui")').first().click();
  await expect(page.getByText(/Rechercher une association, société ou domaine de chasse/i)).toBeVisible({
    timeout: 5000,
  });

  // Click dedicated "Créer une nouvelle ..." button under the "ou" divider
  const createBtn = page.getByRole('button', {
    name: /Créer une nouvelle association, société ou domaine de chasse/i,
  });
  await createBtn.scrollIntoViewIfNeeded();
  await createBtn.click();

  // Full creation form appears
  await expect(page.getByRole('button', { name: /Créer et me rattacher à cette entité/i })).toBeVisible({
    timeout: 5000,
  });

  await page.locator('#raison_sociale').fill('Société de Chasse du Test');
  await page.locator('#raison_sociale').blur();
  await page.locator('#address_ligne_1').fill('12 rue des Bois');
  await page.locator('#address_ligne_1').blur();
  await page.locator('#code_postal').fill('75001');
  await page.locator('#code_postal').blur();
  await page.locator('#ville').fill('Paris');
  await page.locator('#ville').blur();

  const submit = page.getByRole('button', { name: /Créer et me rattacher à cette entité/i });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();

  // After creation the form closes and the new entity appears in the relation list
  await expect(page.getByRole('button', { name: /Me rattacher à une autre entité/i })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/Société de Chasse du Test/i).first()).toBeVisible({ timeout: 10000 });
});

// Scenario 44c — "Chercher une entité existante" link toggles the create form back to the search
test('44c - Onboarding asso : depuis le formulaire de création on peut revenir à la recherche', async ({
  page,
}) => {
  await connectWith(page, 'examinateur-onboarding@example.fr');
  await gotoStep3MesInformationsDeChasse(page);

  await page.locator('label.fr-label:has-text("Oui")').first().click();
  await expect(page.getByText(/Rechercher une association, société ou domaine de chasse/i)).toBeVisible({
    timeout: 5000,
  });

  await page
    .getByRole('button', { name: /Créer une nouvelle association, société ou domaine de chasse/i })
    .click();
  await expect(page.getByRole('button', { name: /Créer et me rattacher à cette entité/i })).toBeVisible({
    timeout: 5000,
  });

  await page.getByRole('button', { name: /Chercher une entité existante/i }).click();
  await expect(page.getByText(/Rechercher une association, société ou domaine de chasse/i)).toBeVisible({
    timeout: 5000,
  });
});
