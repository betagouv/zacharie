import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('CHASSEUR_MULTI_STATUS');
});

// `chasseur-fiches.tsx:307` concatenates `[...feisAssigned, ...feisOngoing, ...feisDone]`
// — which is what produces the implicit ordering À compléter → En cours → Clôturée in the UI.
// This test pins that ordering so a future refactor of `getFeisSorted` (or the concatenation
// in chasseur-fiches.tsx) can't silently change the user-visible order of fiches.
test('Fiches list orders À compléter > En cours > Clôturée', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');

  await page.goto('http://localhost:3290/app/chasseur/fiches');

  // Three fiche cards from CHASSEUR_MULTI_STATUS seed — one per status.
  // Wait until at least three card links are mounted (the list is local-first + lazy-loaded).
  const feiLinks = page.locator('a[href*="/app/chasseur/fei/ZACH-"]');
  await expect(feiLinks).toHaveCount(3, { timeout: 15000 });

  // Status badges appear in DOM order matching the fei concatenation order. We assert their
  // visible text matches [À compléter, En cours, Clôturée] in that exact sequence.
  // The badges' container has `font-semibold uppercase` classes; we select by text content
  // and rely on the order Playwright resolves locator collections (document order).
  const statusBadges = page.locator('span').filter({ hasText: /^(À compléter|En cours|Clôturée)$/ });
  await expect(statusBadges).toHaveCount(3, { timeout: 5000 });

  const texts = await statusBadges.allTextContents();
  expect(texts).toEqual(['À compléter', 'En cours', 'Clôturée']);
});
