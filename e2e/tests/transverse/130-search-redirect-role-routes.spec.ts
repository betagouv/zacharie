import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

async function searchUntilVisible(page: Page, text: string, expected: Locator) {
  await expect(async () => {
    const search = page.getByPlaceholder('Rechercher (carcasse ou fiche en cours)').first();
    await search.fill('');
    await search.fill(text);
    await expect(expected).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}

test.describe('Search dropdown redirectUrl', () => {
  test('SVI search lands on /app/svi/fei/:numero', async ({ page }) => {
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await searchUntilVisible(page, feiId, result);
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/svi/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}/`));
  });

  test('ETG search lands on /app/etg/fei/:numero', async ({ page }) => {
    await resetDb('ETG_TAKEN_CHARGE');
    const feiId = 'ZACH-20250707-QZ6E0-235242';
    await connectWith(page, 'etg-1@example.fr');
    await expect(page).toHaveURL(/\/app\/etg/);

    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await searchUntilVisible(page, feiId, result);
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/etg/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}/`));
  });

  test('COLLECTEUR search lands on /app/collecteur/fei/:numero', async ({ page }) => {
    await resetDb('COLLECTEUR_TAKEN_CHARGE');
    const feiId = 'ZACH-20250707-QZ6E0-245242';
    await connectWith(page, 'collecteur-pro@example.fr');
    await expect(page).toHaveURL(/\/app\/collecteur/);

    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await searchUntilVisible(page, feiId, result);
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/collecteur/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}/`));
  });

  test('CHASSEUR search lands on /app/chasseur/fei/:numero', async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const result = page.getByRole('link', { name: new RegExp(feiId) });
    await searchUntilVisible(page, feiId, result);
    await expect(result).toHaveAttribute('href', `/app/chasseur/fei/${feiId}`);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });

  test('CIRCUIT-COURT search lands on /app/circuit-court/fei/:numero/:id', async ({ page }) => {
    await resetDb('COMMERCE_DE_DETAIL');
    const feiId = 'ZACH-20250707-QZ6E0-195242';
    await connectWith(page, 'commerce-de-detail@example.fr');
    await expect(page).toHaveURL(/\/app\/circuit-court/);

    const result = page.getByRole('link', { name: new RegExp(`Fiche ${feiId}`) }).first();
    await searchUntilVisible(page, feiId, result);
    await expect(result).toHaveAttribute('href', new RegExp(`^/app/circuit-court/fei/${feiId}/`));
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}/`));
  });

  test('SVI carcasse search lands on /app/svi/carcasse-svi/:numero/:zid', async ({ page }) => {
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const result = page.locator(`a[href="/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}"]`);
    await searchUntilVisible(page, bracelet, result);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}`);
  });

  test('CIRCUIT-COURT carcasse search lands on /app/circuit-court/fei/:numero/:id', async ({ page }) => {
    await resetDb('COMMERCE_DE_DETAIL');
    const feiId = 'ZACH-20250707-QZ6E0-195242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'commerce-de-detail@example.fr');
    await expect(page).toHaveURL(/\/app\/circuit-court/);

    const result = page.locator(`a[href^="/app/circuit-court/fei/${feiId}/"]`).first();
    await searchUntilVisible(page, bracelet, result);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}/`));
  });

  test('CHASSEUR carcasse search lands on /app/chasseur/fei/:numero', async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const result = page.locator(`a[href="/app/chasseur/fei/${feiId}"]`);
    await searchUntilVisible(page, bracelet, result);
    await result.click();
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });

  test('SVI commentaire search resolves to the carcasse', async ({ page }) => {
    await resetDb('SVI');
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    const bracelet = 'MM-001-001';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const result = page.locator(`a[href="/app/svi/carcasse-svi/${feiId}/${feiId}_${bracelet}"]`);
    await searchUntilVisible(page, 'RECHERCHE-COMMENTAIRE-TEST', result);
  });

  test('no match shows the "aucun élément" message', async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    await searchUntilVisible(
      page,
      'zzz-aucun-resultat-possible-zzz',
      page.getByText('Aucun élément ne correspond à votre recherche')
    );
  });
});

test.describe('Email link URLs resolve', () => {
  test('Auto-closing email URL /app/chasseur/fei/:numero resolves', async ({ page }) => {
    await resetDb('EXAMINATEUR_INITIAL');
    const feiId = 'ZACH-20250707-QZ6E0-155242';
    await connectWith(page, 'examinateur@example.fr');

    await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  });

  test('Admin notification URL /app/chasseur/profil/informations-de-chasse resolves', async ({ page }) => {
    await resetDb('EXAMINATEUR_INITIAL');
    await connectWith(page, 'examinateur@example.fr');

    await page.goto('http://localhost:3290/app/chasseur/profil/informations-de-chasse?open-entity=test-id', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/app\/chasseur\/profil\/informations-de-chasse/);
  });
});
