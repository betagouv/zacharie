import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 120 — Vue agrégée /etg/carcasses respecte le dispatch.
// Après dispatch, ETG 1 voit seulement ses carcasses dans la vue agrégée (pas juste la vue fiche).

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("/etg/carcasses ne leak pas les carcasses d'une autre branche", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // PD dispatche 2/2 entre ETG 1 / ETG 2
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const g1Stockage = page.getByText("Pas de stockage").first();
  await g1Stockage.scrollIntoViewIfNeeded();
  await g1Stockage.click();
  const g1Transport = page.getByText("Je transporte les carcasses moi").first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
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

  // ETG 1 : /etg/carcasses ne voit que 001/002
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.goto("http://localhost:3290/app/etg/carcasses");
  await expect(page.getByText("MM-001-001").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-002").first()).toBeVisible();
  await expect(page.getByText("MM-001-003")).not.toBeVisible();
  await expect(page.getByText("MM-001-004")).not.toBeVisible();

  // ETG 2 : /etg/carcasses ne voit que 003/004
  await logoutAndConnect(page, "etg-2@example.fr");
  await page.goto("http://localhost:3290/app/etg/carcasses");
  await expect(page.getByText("MM-001-003").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-004").first()).toBeVisible();
  await expect(page.getByText("MM-001-001")).not.toBeVisible();
  await expect(page.getByText("MM-001-002")).not.toBeVisible();
});
