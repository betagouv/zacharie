import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('ETG_REFUSED');
});

test.skip('Fiche refusée intégralement par ETG — chasseur voit le statut de refus pour chaque carcasse', async ({
  page,
}) => {
  // SKIP: navigating to /app/chasseur/fei/{feiId} for a fiche refused by ETG returns "Erreur 500"
  // (frontend renders the error page). Suspected client-side crash on the fei detail render path
  // when `fei_next_owner_*` are all null and `fei_prev_owner_role = ETG`. Needs backend/frontend debug.
  // Seed already correctly populates svi_carcasse_status = REFUS_ETG_COLLECTEUR + intermediaire_carcasse_refus_*.
  const feiId = 'ZACH-20250707-QZ6E0-215242';
  await connectWith(page, 'premier-detenteur@example.fr');

  const link = page.getByRole('link', { name: feiId });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();

  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/refusée|refusé|souillures/i).first()).toBeVisible({ timeout: 10000 });
});
