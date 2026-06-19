import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 130 — Global search redirects to role-specific routes.
// The search dropdown runs locally (searchLocally, over the downloaded carcasses/feis) and builds
// redirectUrl per role: /app/svi/fei/…, /app/etg/fei/…, /app/chasseur/fei/…. Plus the auto-closing
// email URL /app/chasseur/fei/… must resolve to a real page. Locking these down so we can later
// remove /app/tableau-de-bord without breaking notifications or the search dropdown.

test.use({ launchOptions: { slowMo: 100 } });

test.describe('Search dropdown redirectUrl', () => {
  test('SVI search lands on /app/svi/fei/:numero', async ({ page }) => {
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    const result = page.getByRole('link', { name: new RegExp(feiId) });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', `/app/svi/fei/${feiId}`);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/svi/fei/${feiId}`);
  });

  test('ETG search lands on /app/etg/fei/:numero', async ({ page }) => {
    await resetDb('ETG_TAKEN_CHARGE');
    const feiId = 'ZACH-20250707-QZ6E0-235242';
    await connectWith(page, 'etg-1@example.fr');
    await expect(page).toHaveURL(/\/app\/etg/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    const result = page.getByRole('link', { name: new RegExp(feiId) });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', `/app/etg/fei/${feiId}`);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/etg/fei/${feiId}`);
  });

  test('COLLECTEUR search lands on /app/collecteur/fei/:numero', async ({ page }) => {
    // Regression: the old backend search routed collecteurs to /app/etg/fei/… (shared ETG handler).
    // The local search must build the collecteur's own route.
    await resetDb('COLLECTEUR_TAKEN_CHARGE');
    const feiId = 'ZACH-20250707-QZ6E0-245242';
    await connectWith(page, 'collecteur-pro@example.fr');
    await expect(page).toHaveURL(/\/app\/collecteur/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    const result = page.getByRole('link', { name: new RegExp(feiId) });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', `/app/collecteur/fei/${feiId}`);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/collecteur/fei/${feiId}`);
  });

  test('CHASSEUR search lands on /app/chasseur/fei/:numero', async ({ page }) => {
    // PREMIER_DETENTEUR seed creates fei 155242 owned by the examinateur (QZ6E0),
    // which is what the chasseur search filter looks for. EXAMINATEUR_INITIAL has
    // no seed branch and would leave the DB empty.
    await resetDb('PREMIER_DETENTEUR');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    const result = page.getByRole('link', { name: new RegExp(feiId) });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', `/app/chasseur/fei/${feiId}`);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });
});

test.describe('Email link URLs resolve', () => {
  // Mirrors the URLs baked into outgoing emails:
  // - formatAutomaticClosingEmailForChasseur → /app/chasseur/fei/:numero
  // - user-entity admin notification        → /app/chasseur/profil/coordonnees?open-entity=:id
  // If a chasseur opens these links after auth, they must land on the real page (no redirect, no crash).

  test('Auto-closing email URL /app/chasseur/fei/:numero resolves', async ({ page }) => {
    await resetDb('EXAMINATEUR_INITIAL');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    await connectWith(page, 'examinateur@example.fr');

    await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });

  test('Admin notification URL /app/chasseur/profil/coordonnees resolves', async ({ page }) => {
    await resetDb('EXAMINATEUR_INITIAL');
    await connectWith(page, 'examinateur@example.fr');

    await page.goto('http://localhost:3290/app/chasseur/profil/coordonnees?open-entity=test-id', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/app\/chasseur\/profil\/coordonnees/);
  });
});
