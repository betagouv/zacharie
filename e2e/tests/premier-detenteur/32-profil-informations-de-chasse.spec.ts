import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// Scenario 32a — Profil → Associations de chasse : page loads and PD's seeded relation is visible.
test('32a - Profil associations de chasse : page se charge et association seedée visible', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/associations-de-chasse');
  await expect(page).toHaveURL(/\/profil\/associations-de-chasse/);

  // PD has CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY relation with "Association de chasseurs" (seed line 458)
  await expect(page.getByText(/Association de chasseurs/i).first()).toBeVisible({ timeout: 10000 });
});

// Scenario 32b — Profil → Partenaires : page loads.
test('32b - Profil partenaires : page se charge', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/partenaires');
  await expect(page).toHaveURL(/\/profil\/partenaires/);

  // Page should render without crashing — no 500 / "Erreur" headings
  await expect(page.getByRole('heading', { name: /Erreur/i })).toHaveCount(0);
});

// Scenario 32c — Profil → CCGs : page loads and pre-seeded CCG-01 visible.
test('32c - Profil CCGs : page se charge et CCG-01 visible', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  await expect(page).toHaveURL(/\/profil\/ccgs/);

  // CCG-01 is the depot for the seeded fei (premier_detenteur_depot_entity = 'CCG Chasseurs' / numero CCG-01)
  // The seed maps the entity id to the fei, so the user should see this CCG in their list.
  // If empty (no CCG link yet), the page should still render its add-CCG entry point.
  const ccgVisible = page.getByText(/CCG-01|CCG Chasseurs|chambre froide/i).first();
  await expect(ccgVisible).toBeVisible({ timeout: 10000 });
});
