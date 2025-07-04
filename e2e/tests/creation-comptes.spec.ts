import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../scripts/connect-with";

test.beforeAll(async () => {
  await resetDb();
});

test("Création de compte examinateur initial", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Examinateur InitialVous avez").click();
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
  await page.getByRole("button", { name: "Enregistrer mon entité" }).click();
  await page.getByRole("textbox", { name: "Raison Sociale *" }).fill("Association de lapins chasseurs");
  await page.getByRole("textbox", { name: "SIRET" }).fill("1234");
  await page.locator("#address_ligne_1").fill("120 rue de la paix");
  await page.locator("#association_data_form #code_postal").fill("75012");
  await page.getByRole("button", { name: "PARIS 12" }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByText("J'autorise le fait que les").click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByText("Merci pour votre inscription à Zacharie!")).toBeVisible();
});

test("Création de compte premier détenteur", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("premier-detenteur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Premier DétenteurVous êtes un").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click();
  await page.getByRole("option", { name: "Association de chasseurs -" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click(); // add
  await page.getByRole("button", { name: "Masquer le message" }).click();
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click(); // delete
  await page.getByRole("option", { name: "Association de chasseurs -" }).click(); // re-add
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Enregistrer mon entité" }).click();
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
  await page.getByRole("link", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Création de compte examinateur initial + premier détenteur", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page
    .getByRole("textbox", { name: "Mon email Renseignez votre" })
    .fill("examinateur-initial-premier-detenteur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Premier DétenteurVous êtes un").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click();
  await page.getByRole("option", { name: "Association de chasseurs -" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click(); // add
  await page.getByRole("button", { name: "Masquer le message" }).click();
  await page.locator(".select-onboarding-etape-2-associations-data__input-container").click(); // delete
  await page.getByRole("option", { name: "Association de chasseurs -" }).click(); // re-add
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Enregistrer mon entité" }).click();
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
  await page.getByRole("link", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Création de compte collecteur pro", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("collecteur-pro-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Collecteur ProfessionnelVous").click();

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-collecteur-pro-data__input-container").click();
  await page.getByRole("option", { name: "Collecteur Pro 1 - 75000 Paris" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("J'autorise le fait que les").click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByText("Votre compte est en attente d'activation")).toBeVisible();
});

test("Création de compte établissement de traitement du gibier", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("etg-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Établissement de Traitement").click();

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-etg-data__input-container").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("J'autorise le fait que les").click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByText("Votre compte est en attente d'activation")).toBeVisible();
});

test("Création de compte collecteur + établissement de traitement du gibier", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("collecteur-pro+etg-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Collecteur ProfessionnelVous").click();
  await page.getByText("Établissement de Traitement").click();

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-collecteur-pro-data__input-container").click();
  await page.getByRole("option", { name: "Collecteur Pro 1 - 75000 Paris" }).click();
  await page.getByRole("button", { name: "Ajouter" }).first().click();
  await page.locator(".select-onboarding-etape-2-etg-data__input-container").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris" }).click();
  await page.getByRole("button", { name: "Ajouter" }).last().click();
  await page.getByText("J'autorise le fait que les").click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByText("Votre compte est en attente d'activation")).toBeVisible();
});

test("Création de compte SVI", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("svi-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Service Vétérinaire d'").click();

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.locator(".select-onboarding-etape-2-svi-data__input-container").click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByText("Votre compte est en attente d'activation")).toBeVisible();
});
