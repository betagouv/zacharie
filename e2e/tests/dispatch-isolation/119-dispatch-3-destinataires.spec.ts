import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 119 — Dispatch 3 destinataires : ETG 1 / ETG 2 / Collecteur 1.
// Seed has 4 carcasses. Split: group 1 keeps 2, group 2 gets 1, group 3 gets 1.
// Clicking nth(0) in group 2 moves MM-001-001 to group 2.
// Clicking nth(0) in group 3 moves the next available first button to group 3.
// After group 2 takes MM-001-001: group 1 has 003/004/002, group 2 has 001.
// Then group 3 nth(0) moves MM-001-002 to group 3 (first not-in-group-3 button).
// Result: group 1 (ETG 1) = 003/004, group 2 (ETG 2) = 001, group 3 (Collecteur) = 002.

test.setTimeout(150_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Split 4 carcasses entre ETG 1 / ETG 2 / Collecteur Pro 1", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Group 1 : ETG 1 (starts with all 4 carcasses)
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const g1Stockage = page.getByText("Pas de stockage").first();
  await g1Stockage.scrollIntoViewIfNeeded();
  await g1Stockage.click();
  const g1Transport = page.getByText("Je transporte les carcasses moi").first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  // Ajouter group 2 : ETG 2
  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
  // Move 1 carcasse (MM-001-001) to group 2
  await g2Btns.nth(0).click();
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();
  const g2Stockage = group2.getByText("Pas de stockage").first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText("Je transporte les carcasses moi").first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  // Ajouter group 3 : Collecteur Pro 1
  const ajouterBtn2 = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn2.scrollIntoViewIfNeeded();
  await ajouterBtn2.click();
  const group3 = page.locator("div.rounded.border").nth(2);
  await group3.scrollIntoViewIfNeeded();
  const g3Btns = group3.locator("button[type='button']").filter({ hasText: "N°" });
  // Move 1 carcasse (MM-001-002, which is nth(1)) to group 3
  // nth(0) would be MM-001-001 which is already in group 2 - clicking it would steal from group 2
  await g3Btns.nth(1).click();
  await group3.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /Collecteur Pro 1/i }).click();
  // Collecteur needs stockage selection
  const g3Stockage = group3.getByText("Pas de stockage").first();
  await g3Stockage.scrollIntoViewIfNeeded();
  await g3Stockage.click();

  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // Chaque destinataire ne voit que son lot
  await page.setViewportSize({ width: 1280, height: 900 });

  // ETG 1: group 1 kept 2 carcasses (003/004)
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (2)")).toBeVisible({ timeout: 10000 });

  // ETG 2: group 2 got 1 carcasse (001)
  await logoutAndConnect(page, "etg-2@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (1)")).toBeVisible({ timeout: 10000 });

  // Collecteur: group 3 got 1 carcasse (002)
  await logoutAndConnect(page, "collecteur-pro@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (1)")).toBeVisible({ timeout: 10000 });
});
