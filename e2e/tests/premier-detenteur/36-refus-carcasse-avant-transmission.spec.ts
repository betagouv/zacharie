import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test.skip("Refus d'une carcasse avant transmission — ETG reçoit N-1", async ({ page }) => {
  // SKIP: PD cannot refuse individual carcasses before transmission. PD can only DELETE
  // carcasses (spec 37) or transmit all of them. Carcasse refusal is an ETG/collecteur action
  // that happens via the intermediaire-carcasse modal after taking charge.
  // The "Carcasse refusée" radio only appears in the intermediaire view (ETG/collecteur role).
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
});
