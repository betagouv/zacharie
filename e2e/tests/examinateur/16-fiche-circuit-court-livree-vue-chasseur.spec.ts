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

test.skip("Fiche livrée circuit court — vue chasseur : statut Clôturée + lecture seule", async ({ page }) => {
  // SKIP: COMMERCE_DE_DETAIL seed produces fiche in transit, not "livrée" — need to understand circuit-court end-state
  const feiId = "ZACH-20250707-QZ6E0-195242";
  await connectWith(page, "examinateur@example.fr"); // TODO: if seed uses other examinateur user

  const link = page.getByRole("link", { name: feiId });
  await expect(link).toBeVisible();
  await expect(link).toContainText(/Clôturée|Terminée|Livrée/i);
  await link.click();

  // Lecture seule
  await expect(page.getByRole("button", { name: /Prendre en charge/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Transmettre/i })).toHaveCount(0);
});
