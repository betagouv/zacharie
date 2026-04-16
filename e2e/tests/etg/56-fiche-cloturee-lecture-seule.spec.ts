import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 56 — Fiche clôturée : lecture seule, pas de bouton d'action.
test("ETG ne peut plus agir sur une fiche clôturée", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await page.goto(`http://localhost:3290/app/etg/fei/${feiId}`);
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  // Aucun bouton "Prendre en charge" / "Transmettre la fiche" ne doit être visible.
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Transmettre la fiche" })).toHaveCount(0);
});
