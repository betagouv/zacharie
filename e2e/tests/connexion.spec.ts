import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../scripts/connect-with";

// test.beforeAll(async () => {
//   await resetDb();
// });

test("Try to login and success", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});

test("Try to login and password failure", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr", "secret-mauvais-secretasdfdsaf");
  await expect(page.getByText("Le mot de passe est incorrect")).toBeVisible();
});

test("Try to create account with existing email", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Un compte existe déjà avec").click();
  await page.getByRole("link", { name: "Cliquez ici pour vous" }).click();
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});

test.describe("Account creation", () => {
  test.beforeAll(async () => {
    await resetDb();
  });

  test("Try to login and email failure", async ({ page }) => {
    await connectWith(page, "examinateur-pas-encore-existe@example.fr", "secret-mauvais-secret");
    await page.getByText("L'email est incorrect, ou vous n'avez pas encore de compte").click();
    await page.getByRole("link", { name: "Cliquez ici pour en créer un" }).click();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Renseignez vos rôles" })).toBeVisible();
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
    await page.getByText("Le CCG identifié dans").click();
  });
});
