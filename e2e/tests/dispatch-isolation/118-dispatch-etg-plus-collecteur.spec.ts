import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 118 — Dispatch ETG + collecteur : isolation croisée.
// ETG 1 ne voit pas les carcasses du collecteur, collecteur ne voit pas celles de l'ETG.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("ETG et collecteur ne voient que leur branche", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Group 1 : ETG 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const g1Stockage = page.getByText("Pas de stockage").first();
  await g1Stockage.scrollIntoViewIfNeeded();
  await g1Stockage.click();
  const g1Transport = page.getByText("Je transporte les carcasses moi").first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  // Ajouter group 2
  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  // Group 2 : Collecteur Pro 1
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /Collecteur Pro 1/i }).click();
  const g2Stockage = group2.getByText("Pas de stockage").first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText("Je transporte les carcasses moi").first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // ETG 1 ne voit PAS les carcasses du collecteur
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-001").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-002").first()).toBeVisible();
  await expect(page.getByText("MM-001-003")).not.toBeVisible();
  await expect(page.getByText("MM-001-004")).not.toBeVisible();

  // Collecteur ne voit PAS les carcasses de ETG 1
  await logoutAndConnect(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-003").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-004").first()).toBeVisible();
  await expect(page.getByText("MM-001-001")).not.toBeVisible();
  await expect(page.getByText("MM-001-002")).not.toBeVisible();
});
