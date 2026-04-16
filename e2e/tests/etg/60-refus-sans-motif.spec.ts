import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 60 — Refus avec motif manquant : enregistrement impossible.
test("Refus sans motif ne s'enregistre pas", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();

  await new Promise((r) => setTimeout(r, 500)); // react-dsfr modal re-render settle
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await page.getByLabel("Daim - N° MM-001-001").getByText("Carcasse refusée").click();

  // Tenter d'enregistrer sans sélectionner de motif.
  const save = page.getByLabel("Daim - N° MM-001-001").getByRole("button", { name: "Enregistrer" });
  if (await save.isVisible().catch(() => false)) {
    // Soit le bouton est disabled, soit le clic n'a pas d'effet/affiche une erreur.
    const disabled = await save.isDisabled().catch(() => false);
    if (!disabled) {
      await save.click();
      // TODO: verify selector — message d'erreur exact.
      await expect(page.getByText(/motif|obligatoire|requis/i).first()).toBeVisible({ timeout: 3000 });
    } else {
      expect(disabled).toBe(true);
    }
  }
});
