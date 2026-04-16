import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb("SVI_CLOSED");
});

test("Fiche clôturée SVI — vue chasseur : décision finale visible, aucune action possible", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242"; // TODO: verify feiId from SVI_CLOSED seed
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  const link = page.getByRole("link", { name: feiId });
  await expect(link).toBeVisible();
  await expect(link).toContainText(/Clôturée|Terminée/i);
  await link.click();

  // Pas de bouton d'action
  await expect(page.getByRole("button", { name: /Prendre en charge/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Transmettre/i })).toHaveCount(0);

  // Ouvrir la carcasse-svi view
  const firstCarcasse = page.getByRole("button", { name: /Daim N°|Pigeon/ }).first();
  await firstCarcasse.scrollIntoViewIfNeeded();
  await firstCarcasse.click();

  await expect(page.getByText(/Décision SVI|Acceptée|Refusée|Consignée/i).first()).toBeVisible();
});
