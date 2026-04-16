import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 57 — Tentative de transmettre sans prochain détenteur → erreur.
test("Erreur 'Il manque le prochain détenteur' si aucun choisi", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();

  // Définir la date de prise en charge puis tenter de transmettre sans choisir un destinataire.
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  await expect(page.getByText(/Il manque le prochain dé/)).toBeVisible({ timeout: 5000 });
});
