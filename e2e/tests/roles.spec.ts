import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";

test.describe("Conditions sur les cases à cocher pour les rôles", () => {
  test.beforeAll(async () => {
    await resetDb();
  });

  const examinateurInitial = "Examinateur InitialVous avez";
  const premierDetenteur = "Premier DétenteurVous êtes un";
  const collecteurProfessionnel = "Collecteur ProfessionnelVous";
  const etablissementDeTraitement = "Établissement de Traitement";
  const serviceVeterinaire = "Service Vétérinaire d'";

  test("Conditions sur les cases à cocher pour les rôles", async ({ page }) => {
    await page.goto("http://localhost:3290/");
    await page.getByRole("link", { name: "Créer un compte" }).first().click();
    await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("juste-les-cases@example.fr");
    await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await page.getByText(examinateurInitial).click();
    await expect(page.getByText(examinateurInitial)).toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(premierDetenteur).click();
    await expect(page.getByText(examinateurInitial)).toBeChecked(); // on peut être aussi premier détenteur
    await expect(page.getByText(premierDetenteur)).toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(collecteurProfessionnel).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(etablissementDeTraitement).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).toBeChecked(); // on peut être coll et ETG
    await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(serviceVeterinaire).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).toBeChecked(); // on ne peut que être SVI

    await page.getByText(premierDetenteur).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(examinateurInitial).click();
    await expect(page.getByText(examinateurInitial)).toBeChecked();
    await expect(page.getByText(premierDetenteur)).toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(serviceVeterinaire).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).toBeChecked();

    await page.getByText(etablissementDeTraitement).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(collecteurProfessionnel).click();
    await expect(page.getByText(examinateurInitial)).not.toBeChecked();
    await expect(page.getByText(premierDetenteur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
  });
});
