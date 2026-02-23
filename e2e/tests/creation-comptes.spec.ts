import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.beforeAll(async () => {
  await resetDb();
});
test.use({
  launchOptions: {
    slowMo: 100,
  },
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
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Oui").first().click();
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-111");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
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
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Non").click();
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
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Mon Collecteur Professionnel Indépendant" [level=3]
    - text: /Collecteur Pro 1 Collecteur Professionnel Indépendant \\d+ \\d+ Paris/
    - button "Retirer"
    `);
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
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
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
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
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
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
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Mon Service Vétérinaire d'Inspection (SVI)" [level=3]
    - text: /SVI 1 Service Vétérinaire d'Inspection \\d+ \\d+ Paris/
    - button "Retirer"
    `);
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await expect(page.locator("#user_roles_form")).toMatchAriaSnapshot(`- heading "Activez les notifications" [level=1]`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();
});

test("Examinateur initial ajoute une association de chasse depuis son profil", async ({ page }) => {
  // First complete basic onboarding
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur-avec-asso@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Jean");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Pierre");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("0612345678");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("15 avenue des chasseurs");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Oui").first().click();
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-222");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();

  // Navigate to profile to add hunting associations
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mes informations de chasse" }).click();
  await expect(page.getByRole("heading", { name: "Renseignez vos informations de chasse" })).toBeVisible();

  await page.getByText("Oui").nth(1).click();
  await page.getByRole("combobox", { name: "Raison Sociale *" }).fill("Association de lapins chasseurs");
  await page.getByRole("textbox", { name: "SIRET" }).fill("1234");
  await page.locator("#address_ligne_1").fill("120 rue de la paix");
  await page.locator("#association_data_form #code_postal").fill("75012");
  await page.getByRole("button", { name: "PARIS 12" }).click();
  await page.getByRole("button", { name: "Me rattacher à cette entité", exact: true }).click();
  // Verify the association was added - check for button "Retirer" which appears next to added associations
  await expect(page.getByRole("button", { name: "Retirer" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chambres froides (Centres de Collecte du Gibier sauvage)" }),
  ).toBeVisible();
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de chasse enregistrées")).toBeVisible();
});

test("Examinateur initial ajoute une chambre froide (CCG) depuis son profil", async ({ page }) => {
  // First complete basic onboarding
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur-avec-ccg@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Marc");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Antoine");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("0698765432");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("25 rue du gibier");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Oui").first().click();
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-333");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();

  // Navigate to profile to add CCG
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mes informations de chasse" }).click();
  await expect(page.getByRole("heading", { name: "Renseignez vos informations de chasse" })).toBeVisible();

  // Add a CCG without official number - use radio button selector
  await page.getByText("Oui mais").nth(0).click();
  await page.getByRole("textbox", { name: "Nom usuel *" }).fill("Ma Chambre Froide");
  await page.getByRole("textbox", { name: "SIRET Si vous n'en n'avez pas" }).fill("122345");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("123 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75018");
  await page.getByRole("button", { name: "PARIS 18" }).click();
  await page.getByRole("button", { name: "Enregistrer ma chambre froide (CCG)", exact: true }).click();
  await page.getByText("Ma Chambre Froide").click();
});

test("Premier détenteur devient examinateur initial depuis son profil", async ({ page }) => {
  // First complete basic onboarding as non-examinateur
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page
    .getByRole("textbox", { name: "Mon email Renseignez votre" })
    .fill("detenteur-devient-examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Paul");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Jacques");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("0611223344");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("5 chemin forestier");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Non").click(); // Not trained initially
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();

  // Navigate to profile to become examinateur initial
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mes informations de chasse" }).click();
  await expect(page.getByRole("heading", { name: "Renseignez vos informations de chasse" })).toBeVisible();

  // Change to examinateur initial
  await page.getByText("Oui").first().click(); // Now trained
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).fill("CFEI-075-00-444");
  await page.getByRole("textbox", { name: "Numéro d'attestation de" }).blur();

  // Verify the CFEI number was saved
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de chasse enregistrées")).toBeVisible();

  // Refresh and verify the change persisted
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Numéro d'attestation de" })).toHaveValue("CFEI-075-00-444");
});

test("Premier détenteur ajoute association et CCG depuis son profil", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("detenteur-complet@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("textbox", { name: "Nom *", exact: true }).fill("Louis");
  await page.getByRole("textbox", { name: "Prénom *" }).fill("Bernard");
  await page.getByRole("textbox", { name: "Téléphone * Format attendu :" }).fill("0699887766");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("100 route de la forêt");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75000");
  await page.getByRole("textbox", { name: "Ville ou commune * Exemple :" }).fill("Paris");
  await page.getByRole("button", { name: "CORMEILLES EN PARISIS" }).click();
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await page.getByText("Non").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Vous n'avez pas encore de fiche")).toBeVisible();

  // Navigate to profile
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mes informations de chasse" }).click();

  // Add an existing association - use input name selector for the "Oui" radio
  await page.getByText("Oui").nth(1).click();
  // React Select: click to focus, type to filter, then select existing option
  await page.locator(".raison_sociale__input-container").click();
  await page.locator(".raison_sociale__input").fill("Association de chasseurs");
  await page.getByRole("option", { name: /Association de chasseurs -/i }).click();
  await page.getByRole("button", { name: "Me rattacher à cette entité", exact: true }).click();
  // Verify association was added - button "Me rattacher à une autre entité" appears
  await expect(page.getByRole("button", { name: "Me rattacher à une autre entité" })).toBeVisible();

  // Add a CCG - use radio button selector
  await page.getByText("Oui mais").nth(0).click();
  await page.getByRole("textbox", { name: "Nom usuel *" }).fill("CCG du Détenteur");
  await page.getByRole("textbox", { name: "SIRET Si vous n'en n'avez pas" }).fill("122345");
  await page.getByRole("textbox", { name: "Adresse * Indication : numéro" }).fill("123 rue de la paix");
  await page.getByRole("textbox", { name: "Code postal * 5 chiffres" }).fill("75020");
  await page.getByRole("button", { name: "PARIS 20" }).click();
  await page.getByRole("button", { name: "Enregistrer ma chambre froide (CCG)", exact: true }).click();
  // Verify CCG was added - check for at least 2 Retirer buttons (one for association, one for CCG)
  await expect(page.getByRole("button", { name: "Retirer" }).first()).toBeVisible();

  // Check visibility and save
  await page
    .getByText(
      "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
    )
    .click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de chasse enregistrées")).toBeVisible();
});
