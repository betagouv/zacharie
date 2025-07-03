import { test, expect } from "@playwright/test";

// test.beforeAll(async () => {
//   await populate();
// });

test("Try to login and success", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.locator("#fr-header-header-with-quick-access-items-quick-access-item-0").click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});

test("Try to login and failure", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.locator("#fr-header-header-with-quick-access-items-quick-access-item-0").click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-mauvais-secretasdfdsaf");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.getByText("Le mot de passe est incorrect").click();
});

test("Create account", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-ce");
  await page.getByText("Afficher").click();
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Examinateur InitialVous avez").click();
  await page.getByText("Premier DétenteurVous êtes un").click();
  await page.getByText("Collecteur ProfessionnelVous").click();
  await page.getByText("Examinateur InitialVous avez").click();
  await page.getByText("Premier DétenteurVous êtes un").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-111");
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click();
  await page.getByRole("option", { name: "Association de chasseurs -" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click(); // add
  await page.getByRole("button", { name: "Masquer le message" }).click();
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click(); // delete
  await page.getByRole("option", { name: "Association de chasseurs -" }).click(); // re-add
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Enregistrer une nouvelle" }).click();
  await page.getByRole("textbox", { name: "Raison Sociale *" }).fill("Association de lapins chasseurs");
  await page.getByRole("textbox", { name: "SIRET" }).fill("1234");
  await page.locator("#address_ligne_1").fill("120 rue de la paix");
  await page.locator("#association_data_form #code_postal").fill("75012");
  await page.getByRole("button", { name: "PARIS 12" }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByText("J'autorise le fait que les").click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await page.getByRole("textbox", { name: "Si vous utilisez un CCG" }).fill("CCG-01");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Masquer le message" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Pré-enregistrer mon CCG" }).click();
  await page.getByRole("textbox", { name: "Nom usuel *" }).fill("CCG-02-001");
  await page.getByRole("textbox", { name: "SIRET Si vous n'en n'avez pas" }).fill("122345");
  await page.getByRole("textbox", { name: "Numéro d'identification du" }).fill("CCG-02-001");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("123 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75018");
  await page.getByRole("button", { name: "PARIS 18" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("textbox", { name: "Nom usuel *" }).fill("CCG-02-001");
  await page.getByText("Nom usuel *SIRETSi vous n'en").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("textbox", { name: "Numéro d'identification du" }).click();
  await page.getByRole("textbox", { name: "Numéro d'identification du" }).fill("CCG-02-001");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Le CCG identifié dans").click();
});
