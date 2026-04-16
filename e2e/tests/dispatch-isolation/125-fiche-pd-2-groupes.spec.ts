import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 125 — Côté PD après dispatch : les 2 groupes sont clairement identifiés.

test.setTimeout(120_000);

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("PD voit la fiche avec les 2 groupes clairement identifiés après dispatch", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Groupe 1 : ETG 1
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

  // Assertions : 2 groupes avec ETG 1 / ETG 2 et leur nombre de carcasses
  await expect(page.getByText(/ETG 1.*2 carcasse/)).toBeVisible();
  await expect(page.getByText(/ETG 2.*2 carcasse/)).toBeVisible();
});
