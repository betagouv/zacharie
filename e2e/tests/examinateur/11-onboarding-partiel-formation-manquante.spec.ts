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
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Onboarding partiel — coordonnées OK mais pas de formation : ChasseurDeactivated affiché", async ({ page }) => {
  // This user has all profile fields but est_forme_a_l_examen_initial is null
  // The gate: user?.est_forme_a_l_examen_initial == null → showDeactivatedAccount = true
  await connectWith(page, "examinateur-sans-formation@example.fr");

  // Navigate to chasseur listing — ChasseurDeactivated is shown instead of Outlet
  await page.goto("http://localhost:3290/app/chasseur");

  // ChasseurDeactivated shows "Merci pour votre inscription" when profile is complete
  // but account is still pending activation (est_forme_a_l_examen_initial is null)
  await expect(
    page.getByText(/Merci pour votre inscription|compléter votre profil/i).first()
  ).toBeVisible({ timeout: 10000 });
});
