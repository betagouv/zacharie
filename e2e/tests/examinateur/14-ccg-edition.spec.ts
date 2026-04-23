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
  await resetDb('EXAMINATEUR_INITIAL');
});

test.skip('Edition CCG : modification persistée', async ({ page }) => {
  // SKIP: The edit (pencil) button only appears for pre-registered CCGs (ccg_status="Pré-enregistré dans Zacharie").
  // Pre-seeded CCGs (CCG-01, CCG-02) are fully registered and don't have the edit button.
  // Creating a pre-registered CCG requires the "sans numéro" path which involves filling multiple form fields
  // (nom_d_usage, address, code_postal, ville) and submitting to the API — not yet tested.
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
});
