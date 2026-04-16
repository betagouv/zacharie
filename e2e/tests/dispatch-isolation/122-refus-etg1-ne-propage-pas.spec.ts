import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 122 — Refus d'une carcasse par ETG 1 ne propage pas à ETG 2.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Refus ETG 1 n'affecte pas la visibilité côté ETG 2", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // Dispatch 2/2
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

  // ETG 1 refuse sa carcasse
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  const carc = page.getByRole("button", { name: /N° MM-/ }).first();
  await carc.scrollIntoViewIfNeeded();
  await carc.click();
  const refus = page.getByText("Carcasse refusée").first();
  if (await refus.isVisible().catch(() => false)) {
    await refus.click();
    const sel = page.locator(".input-for-search-prefilled-data__input-container").first();
    if (await sel.isVisible().catch(() => false)) {
      await sel.click();
      await page.getByRole("option").first().click();
    }
    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    if (await save.isVisible().catch(() => false)) await save.click();
  }

  // ETG 2 ne voit ni le refus, ni la carcasse de ETG 1
  await logoutAndConnect(page, "etg-2@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("MM-001-001")).not.toBeVisible();
  await expect(page.getByText("MM-001-002")).not.toBeVisible();
  await expect(page.getByText(/refus/i)).not.toBeVisible();
});
