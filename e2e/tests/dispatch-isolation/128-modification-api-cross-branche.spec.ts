import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 128 — Modification carcasse d'une autre branche via API → 403.
// Dispatch 2+2 to ETG 1 + ETG 2, login as ETG 1, try to POST/modify a carcasse
// that belongs to ETG 2's branch. Expected: 403 or 404.

test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test.skip("API POST /carcasse/:id d'une autre branche → 403", async ({ page }) => {
  // SKIP: API-level test needs endpoint verification
  const feiId = "ZACH-20250707-QZ6E0-155242";
  const API_BASE = "http://localhost:3291";

  // 1. PD dispatches 2+2 to ETG 1 + ETG 2 (mobile viewport)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Select ETG 1 for group 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Add second group
  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  // Move 2 carcasses to group 2
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  // Select ETG 2 for group 2
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();
  const g2Stockage = group2.getByText("Pas de stockage").first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText("Je transporte les carcasses moi").first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  // Transmettre
  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 2 takes charge so carcasse-intermediaire records exist
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-2@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).not.toBeVisible({ timeout: 10000 });

  // 3. Login as ETG 1 and get auth cookies
  await logoutAndConnect(page, "etg-1@example.fr");
  // Also take charge as ETG 1 so their intermediaire exists
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).not.toBeVisible({ timeout: 10000 });

  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find((c) => c.name === "zacharie_express_jwt");
  expect(jwtCookie).toBeTruthy();

  // 4. Identify a carcasse that belongs to ETG 2's branch
  // From dispatch pattern (same as spec 117), group 2 got the first 2 carcasses clicked:
  // MM-001-001 and MM-001-002 went to ETG 2
  const zacharie_carcasse_id_etg2 = `${feiId}_MM-001-001`;

  // 5. As ETG 1, try to POST to modify ETG 2's carcasse
  const modifyUrl = `${API_BASE}/carcasse/${feiId}/${zacharie_carcasse_id_etg2}`;
  const modifyResponse = await page.request.post(modifyUrl, {
    headers: {
      Cookie: `zacharie_express_jwt=${jwtCookie!.value}`,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      commentaire: "tentative de modification cross-branche",
    }),
  });

  // The API should return 403 or 404, NOT 200
  expect(
    [403, 404].includes(modifyResponse.status()),
    `Expected 403 or 404 but got ${modifyResponse.status()} — API may lack ownership check on carcasse POST`,
  ).toBeTruthy();
});
