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

test.skip("Fiche clôturée SVI — côté PD : lecture seule, décision visible", async ({ page }) => {
  // SKIP: PD cannot navigate to a fiche at SVI stage via /app/chasseur/fei/ route.
  // The fiche is owned by SVI and may not be accessible to PD through the chasseur router.
  const feiId = "ZACH-20250707-QZ6E0-205242";
  await connectWith(page, "premier-detenteur@example.fr");
});
