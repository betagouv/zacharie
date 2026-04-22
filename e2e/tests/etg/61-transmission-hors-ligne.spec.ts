import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 61 — Transmission hors-ligne : sync différée OK.
test("ETG transmet hors-ligne puis synchronise au retour online", async ({ page, context }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();

  // Passer hors-ligne.
  await context.setOffline(true);

  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris (Service" }).click();
  const transmettre = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  // Repasser en ligne → sync auto PQueue.
  await context.setOffline(false);
  await expect(page.getByText("SVI 1 a été notifié")).toBeVisible({ timeout: 15000 });
});
