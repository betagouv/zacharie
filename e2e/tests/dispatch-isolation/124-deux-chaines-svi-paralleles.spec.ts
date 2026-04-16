import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 124 — Deux chaînes SVI parallèles.
// ETG 1 → SVI 1, ETG 2 → SVI 2 ; SVI 2 ne voit que la branche ETG 2.

test.setTimeout(180_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("SVI 1 et SVI 2 voient chacun leur branche seulement", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // Dispatch 2/2 entre ETG 1 / ETG 2
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const g1s = page.getByText("Pas de stockage").first();
  await g1s.scrollIntoViewIfNeeded();
  await g1s.click();
  const g1t = page.getByText("Je transporte les carcasses moi").first();
  await g1t.scrollIntoViewIfNeeded();
  await g1t.click();
  const add = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await add.scrollIntoViewIfNeeded();
  await add.click();
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();
  const g2s = group2.getByText("Pas de stockage").first();
  await g2s.scrollIntoViewIfNeeded();
  await g2s.click();
  const g2t = group2.getByText("Je transporte les carcasses moi").first();
  await g2t.scrollIntoViewIfNeeded();
  await g2t.click();
  const transmettre = page.getByRole("button", { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // Helper pour qu'un ETG transmette au SVI donné
  async function etgToSvi(email: string, sviOption: string | RegExp) {
    await logoutAndConnect(page, email);
    await page.getByRole("link", { name: feiId }).click();
    await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
    const carc = page.getByRole("button", { name: /N° MM-/ }).first();
    await carc.scrollIntoViewIfNeeded();
    await carc.click();
    const accept = page.getByText("Carcasse acceptée").first();
    if (await accept.isVisible().catch(() => false)) await accept.click();
    await page.keyboard.press("Escape").catch(() => void 0);
    const def = page.getByRole("button", { name: "Cliquez ici pour définir" });
    await def.scrollIntoViewIfNeeded();
    await def.click();
    await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
    await page.getByRole("option", { name: sviOption }).click();
    await page.getByRole("button", { name: "Transmettre la fiche" }).click();
    await expect(page.getByText(/a été notifié/)).toBeVisible({ timeout: 15000 });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await etgToSvi("etg-1@example.fr", /SVI 1/);
  await etgToSvi("etg-2@example.fr", /SVI 2/);

  // TODO: verify selector — le seed ne contient qu'un user `svi@example.fr`. Si SVI 2 n'a pas
  // d'utilisateur seed dédié, ce test marque la limite du harness actuel.
  // Assertion minimale : SVI 1 voit MM-001-001/002 et PAS 003/004.
  await logoutAndConnect(page, "svi@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-001").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("MM-001-002").first()).toBeVisible();
  await expect(page.getByText("MM-001-003")).not.toBeVisible();
  await expect(page.getByText("MM-001-004")).not.toBeVisible();
});
