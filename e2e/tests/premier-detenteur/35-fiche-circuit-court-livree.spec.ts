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
  await resetDb("COMMERCE_DE_DETAIL");
});

test("Fiche circuit court livrée — côté PD : statut Clôturée", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242"; // TODO: verify seed feiId
  await connectWith(page, "premier-detenteur@example.fr");

  const link = page.getByRole("link", { name: feiId });
  await expect(link).toBeVisible();
  await expect(link).toContainText(/Clôturée|Livrée|Terminée/i);
  await link.click();

  await expect(page.getByRole("button", { name: /Prendre en charge/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Transmettre/i })).toHaveCount(0);
});
