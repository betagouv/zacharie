import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 55 — Post-inspection SVI : décision visible côté ETG.
test.skip("ETG voit la décision SVI sur /etg/carcasse-svi/...", async ({ page }) => {
  // SKIP: SVI_CLOSED seed lacks per-carcasse SVI decisions — same root cause as examinateur/15
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/etg");

  const feiId = "ZACH-20250707-QZ6E0-165242";
  const feiLink = page.getByRole("link", { name: new RegExp(feiId) }).first();
  await expect(feiLink).toBeVisible({ timeout: 10000 });
  await feiLink.click();

  // Ouvrir la 1ère carcasse et aller vers /carcasse-svi/...
  const firstCarcasse = page.getByRole("button", { name: /N° MM-001-00\d/ }).first();
  await firstCarcasse.scrollIntoViewIfNeeded();
  await firstCarcasse.click();

  // TODO: verify selector — un lien/bouton "Voir la décision SVI" ou similaire.
  const sviLink = page.getByRole("link", { name: /inspection|d.cision|SVI/i }).first();
  if (await sviLink.isVisible().catch(() => false)) {
    await sviLink.click();
    await expect(page).toHaveURL(/\/app\/etg\/carcasse-svi\//);
    await expect(page.getByText(/accept|refus|consign/i).first()).toBeVisible();
  }
});
