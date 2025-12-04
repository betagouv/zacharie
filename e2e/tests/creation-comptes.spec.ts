import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.beforeAll(async () => {
  await resetDb();
});

test("Création de compte examinateur initial", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await page.getByText("Oui").first().click();
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-111");
  await page.getByText("Oui").nth(1).click();
  await page.getByRole("combobox", { name: "Raison Sociale *" }).fill("Association de lapins chasseurs");
  await page.getByRole("textbox", { name: "SIRET" }).fill("1234");
  await page.locator("#address_ligne_1").fill("120 rue de la paix");
  await page.locator("#association_data_form #code_postal").fill("75012");
  await page.getByRole("button", { name: "PARIS 12" }).click();
  await page.getByRole("button", { name: "Me rattacher à cette entité", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chambres froides (Centres de Collecte du Gibier sauvage)" })
  ).toBeVisible();
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens."
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Activez les notifications" })).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Merci pour votre inscription à Zacharie !")).toBeVisible();
});

test("Création de compte premier détenteur", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("premier-detenteur-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await page.getByText("Oui").nth(1).click();
  await page.getByRole("combobox", { name: "Raison Sociale *" }).fill("Association de chasseurs ");
  await page.getByRole("option", { name: "Association de chasseurs -" }).click();
  await page.getByRole("button", { name: "Me rattacher à cette entité", exact: true }).click();
  await page.getByRole("button", { name: "Me rattacher à une autre entité" }).click();
  await page.getByRole("combobox", { name: "Raison Sociale *" }).fill("Association de lapins chasseurs");
  await page.getByRole("textbox", { name: "SIRET" }).fill("1234");
  await page.locator("#address_ligne_1").fill("120 rue de la paix");
  await page.locator("#association_data_form #code_postal").fill("75012");
  await page.getByRole("button", { name: "PARIS 12" }).click();
  await page.getByRole("button", { name: "Me rattacher à cette entité", exact: true }).click();
  await page.getByText("Oui mais la chambre froide n’a pas de numéro d’identification").click();
  await page.getByRole("textbox", { name: "Nom usuel *" }).fill("CCG-02-001");
  await page.getByRole("textbox", { name: "SIRET Si vous n'en n'avez pas" }).fill("122345");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("123 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75018");
  await page.getByRole("button", { name: "PARIS 18" }).click();
  await page.getByRole("button", { name: "Enregistrer ma chambre froide (CCG)", exact: true }).click();
  await page.getByText("Le CCG identifié dans").click();
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens."
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#user_roles_form")).toMatchAriaSnapshot(`- heading "Activez les notifications" [level=1]`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Création de compte collecteur pro", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("collecteur-pro-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Un compte existe déjà avec").click();
  await page.getByRole("link", { name: "Cliquez ici pour vous" }).click();
  await page.getByRole("button", { name: "Me connecter" }).waitFor({ state: "visible" });
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("collecteur-pro-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Mon Collecteur Professionnel Indépendant" [level=3]
    - text: /Collecteur Pro 1 Collecteur Professionnel Indépendant \\d+ \\d+ Paris/
    - button "Retirer"
    `);
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens."
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#user_roles_form")).toMatchAriaSnapshot(`- heading "Activez les notifications" [level=1]`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Création de compte établissement de traitement du gibier", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("etg-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Un compte existe déjà avec").click();
  await page.getByRole("link", { name: "Cliquez ici pour vous" }).click();
  await page.getByRole("button", { name: "Me connecter" }).waitFor({ state: "visible" });
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("etg-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Mon Établissement de Traitement du Gibier sauvage (ETG)" [level=3]
    - text: /ETG 1 Etablissement de Traitement du Gibier sauvage \\d+ \\d+ Paris/
    - button "Retirer"
    - group "Que faites-vous au sein de votre ETG ?":
      - radio "Je peux seulement transporter les carcasses Si vous cochez cette case, les futures fiches seront automatiquement réassignées à votre entreprise pour la réception ultérieure"
      - text: Je peux seulement transporter les carcasses Si vous cochez cette case, les futures fiches seront automatiquement réassignées à votre entreprise pour la réception ultérieure
      - radio "Je peux réceptionner les carcasses et gérer la logistique En cochant cette case, vous pourrez réceptionner les carcasses, et vous pourrez aussi préciser le cas échéant que votre entreprise a également transporté les carcasses vers votre entreprise." [checked]
      - text: Je peux réceptionner les carcasses et gérer la logistique En cochant cette case, vous pourrez réceptionner les carcasses, et vous pourrez aussi préciser le cas échéant que votre entreprise a également transporté les carcasses vers votre entreprise.
    `);
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens."
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#user_roles_form")).toMatchAriaSnapshot(`- heading "Activez les notifications" [level=1]`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Création de compte SVI", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("svi-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Un compte existe déjà avec").click();
  await page.getByRole("link", { name: "Cliquez ici pour vous" }).click();
  await page.getByRole("button", { name: "Me connecter" }).waitFor({ state: "visible" });
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("svi-nouveau@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marcel");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Maurice");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("06123456");
  await page.getByRole("textbox", { name: "Adresse Indication : numéro" }).fill("10 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Mon Service Vétérinaire d'Inspection (SVI)" [level=3]
    - text: /SVI 1 Service Vétérinaire d'Inspection \\d+ \\d+ Paris/
    - button "Retirer"
    `);
  await page.getByRole("button", { name: "Enregistrer et Continuer" }).click();
  await expect(page.locator("#user_roles_form")).toMatchAriaSnapshot(`- heading "Activez les notifications" [level=1]`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});
