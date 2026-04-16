import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

/**
 * TODO: verify si le refus de carcasse est autorisé côté circuit court.
 * CircuitCourtFei utilise <CardCarcasse> (lecture seule), a priori pas d'action de refus.
 */
test("96 - Refuser une carcasse côté circuit court : présence/absence du bouton", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-195242";
  await connectWith(page, "commerce-de-detail@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  // Cliquer sur une carcasse et vérifier s'il existe un bouton "Refuser"
  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  if (await carcasseBtn.isVisible().catch(() => false)) {
    await carcasseBtn.click();
  }

  const refuserBtn = page.getByRole("button", { name: /Carcasse refusée|Refuser/i });
  const count = await refuserBtn.count();
  // TODO: selon règle métier :
  // - si refus autorisé : expect(count).toBeGreaterThan(0)
  // - si refus interdit : expect(count).toBe(0)
  // Tant que la règle n'est pas confirmée, on documente simplement la valeur actuelle.
  console.log(`[scenario 96] nombre de boutons Refuser trouvés côté circuit court : ${count}`);
  expect(count).toBe(0); // assumption: circuit court = terminal → no refus
});
