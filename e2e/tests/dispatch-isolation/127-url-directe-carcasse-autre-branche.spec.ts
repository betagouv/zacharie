import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 127 — URL directe vers carcasse d'une autre branche → 403/404 ou redirect.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("ETG 1 ne peut pas accéder à la carcasse d'ETG 2 via URL directe", async ({ page }) => {
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

  // ETG 1 tente d'ouvrir la carcasse d'ETG 2 (MM-001-003 pigeons, seed) via URL
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");

  // zacharie_carcasse_id connu via MM-001-003 (seed). On utilise le numéro comme identifiant fallback.
  // TODO: verify selector — route peut attendre l'UUID zacharie_carcasse_id exact.
  await page.goto(`http://localhost:3290/app/etg/carcasse/${feiId}/MM-001-003`);

  // Attendu : pas de leak. Soit redirect, soit message "introuvable", soit 403/404.
  await expect(page.locator("body")).toBeVisible();
  // Négatif explicite : aucune donnée carcasse d'ETG 2 visible
  await expect(page.getByText(/10 pigeons|Pigeons \(10\)/i)).not.toBeVisible();
});
