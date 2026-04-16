import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 117 (extension) — Dispatch 2 ETG : NEGATIVE visibility + vue /etg/carcasses agrégée.
// Extends the existing fiche_dispatch_multi_destinataires spec with explicit .not.toBeVisible()
// assertions on the OTHER branch's carcasse numbers, + check the aggregate /etg/carcasses view
// does not leak cross-branch carcasses.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Dispatch 2 ETG : isolation négative + vue agrégée", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. PD dispatche (viewport mobile)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
  // Déplacer MM-001-003 (pigeons) et MM-001-004 dans le groupe 2
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();
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

  // 2. ETG 1 : voit SES carcasses (MM-001-001, MM-001-002), ne voit PAS celles de ETG 2
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-001").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-002").first()).toBeVisible();
  // Négatif explicite
  await expect(page.getByText("MM-001-003")).not.toBeVisible();
  await expect(page.getByText("MM-001-004")).not.toBeVisible();

  // Vue agrégée /etg/carcasses respecte le dispatch
  await page.goto("http://localhost:3290/app/etg/carcasses");
  await expect(page.getByText("MM-001-001").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-002").first()).toBeVisible();
  await expect(page.getByText("MM-001-003")).not.toBeVisible();
  await expect(page.getByText("MM-001-004")).not.toBeVisible();

  // 3. ETG 2 : voit MM-001-003, MM-001-004 ; ne voit PAS MM-001-001/002
  await logoutAndConnect(page, "etg-2@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-003").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-004").first()).toBeVisible();
  await expect(page.getByText("MM-001-001")).not.toBeVisible();
  await expect(page.getByText("MM-001-002")).not.toBeVisible();

  await page.goto("http://localhost:3290/app/etg/carcasses");
  await expect(page.getByText("MM-001-003").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-004").first()).toBeVisible();
  await expect(page.getByText("MM-001-001")).not.toBeVisible();
  await expect(page.getByText("MM-001-002")).not.toBeVisible();
});
