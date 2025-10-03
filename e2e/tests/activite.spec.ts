import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";

test.describe("Conditions sur les cases à cocher pour les activités", () => {
  test.beforeAll(async () => {
    await resetDb();
  });

  const chasseur = "Chasseur et/ou Examinateur Initial";
  const collecteurProfessionnel = "Collecteur Professionnel Indépendant";
  const etablissementDeTraitement = "Établissement de Traitement du Gibier sauvage (ETG)";
  const serviceVeterinaire = "Service Vétérinaire d'Inspection (SVI)";

  test("Conditions sur les cases à cocher pour les activités", async ({ page }) => {
    await page.goto("http://localhost:3290/");
    await page.getByRole("link", { name: "Créer un compte" }).first().click();
    await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("juste-les-cases@example.fr");
    await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await page.getByText(chasseur).click();
    await expect(page.getByText(chasseur)).toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(collecteurProfessionnel).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(etablissementDeTraitement).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked(); // on peut être coll et ETG
    await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(serviceVeterinaire).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).toBeChecked(); // on ne peut que être SVI

    await page.getByText(chasseur).click();
    await expect(page.getByText(chasseur)).toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(serviceVeterinaire).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).toBeChecked();

    await page.getByText(etablissementDeTraitement).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();

    await page.getByText(collecteurProfessionnel).click();
    await expect(page.getByText(chasseur)).not.toBeChecked();
    await expect(page.getByText(collecteurProfessionnel)).toBeChecked();
    await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
    await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
  });
});
