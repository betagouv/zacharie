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

    // Le SVI navigue vers une transmission : /app/svi/fei/:numero/:premier_detenteur_prochain_detenteur_id_cache
    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/svi/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}/`));
  });

  test('ETG search lands on /app/etg/fei/:numero', async ({ page }) => {
    await resetDb('ETG_TAKEN_CHARGE');
    const feiId = 'ZACH-20250707-QZ6E0-235242';
    await connectWith(page, 'etg-1@example.fr');
    await expect(page).toHaveURL(/\/app\/etg/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    // L'ETG navigue vers une transmission : /app/etg/fei/:numero/:premier_detenteur_prochain_detenteur_id_cache
    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/etg/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}/`));
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

    // Le collecteur navigue vers une transmission : /app/collecteur/fei/:numero/:premier_detenteur_prochain_detenteur_id_cache
    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/collecteur/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}/`));
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

  test('CIRCUIT-COURT search lands on /app/circuit-court/fei/:numero/:id', async ({ page }) => {
    // Le routeur circuit court n'a QUE /app/circuit-court/fei/:fei_numero/:premier_detenteur_prochain_detenteur_id_cache.
    // La recherche doit donc émettre une URL de transmission (comme ETG/collecteur), pas la fiche seule.
    await resetDb('COMMERCE_DE_DETAIL');
    const feiId = 'ZACH-20250707-QZ6E0-195242';
    await connectWith(page, 'commerce-de-detail@example.fr');
    await expect(page).toHaveURL(/\/app\/circuit-court/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(feiId);

    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/circuit-court/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}/`));
  });

  test('SVI carcasse search lands on /app/svi/carcasse-svi/:numero/:zid', async ({ page }) => {
    // Recherche par numéro de bracelet : le SVI ouvre la page d'inspection de la carcasse, pas la fiche.
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(bracelet);

    const result = page.locator(`a[href="/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}"]`);
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}`);
  });

  test('CIRCUIT-COURT carcasse search lands on /app/circuit-court/fei/:numero/:id', async ({ page }) => {
    // Recherche par bracelet : le circuit court n'a pas de page carcasse dédiée, il ouvre la transmission.
    await resetDb('COMMERCE_DE_DETAIL');
    const feiId = 'ZACH-20250707-QZ6E0-195242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'commerce-de-detail@example.fr');
    await expect(page).toHaveURL(/\/app\/circuit-court/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(bracelet);

    const result = page.locator(`a[href^="/app/circuit-court/fei/${feiId}/"]`).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}/`));
  });

  test('CHASSEUR carcasse search lands on /app/chasseur/fei/:numero', async ({ page }) => {
    // Recherche par bracelet : le chasseur ouvre la fiche (route bare fei/:fei_numero).
    await resetDb('PREMIER_DETENTEUR');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill(bracelet);

    const result = page.locator(`a[href="/app/chasseur/fei/${feiId}"]`);
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });

  test('SVI commentaire search resolves to the carcasse', async ({ page }) => {
    // Recherche par commentaire d'intermédiaire (seedé sur MM-001-001, cf. populate-test-db seed SVI),
    // résolue vers sa carcasse.
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill('RECHERCHE-COMMENTAIRE-TEST');

    const result = page.locator(`a[href="/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}"]`);
    await expect(result).toBeVisible({ timeout: 10000 });
  });

  test('no match shows the "aucun élément" message', async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill('zzz-aucun-resultat-possible-zzz');

    await expect(page.getByText('Aucun élément ne correspond à votre recherche')).toBeVisible({
      timeout: 10000,
    });
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
