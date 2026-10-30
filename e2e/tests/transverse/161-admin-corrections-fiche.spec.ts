import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 161 — Corrections admin d'une fiche transmise, depuis la page fiche de l'admin : date de mise
// à mort, premier détenteur, ajout et suppression de carcasse. Une fiche clôturée ne se corrige plus.

const feiAuPremierDetenteur = 'ZACH-20250707-QZ6E0-155242';
const feiCloturee = 'ZACH-20250707-QZ6E0-205242';

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdmin(page: Page, path: string) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto(`http://localhost:3290${path}`);
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(new RegExp(path), { timeout: 10000 });
}

test.describe('fiche pas encore prise en charge', () => {
  test.beforeEach(async () => {
    await resetDb('PREMIER_DETENTEUR');
  });

  test("l'admin corrige la date de mise à mort et le premier détenteur", async ({ page }) => {
    await openAdmin(page, `/app/admin/fei/${feiAuPremierDetenteur}`);

    const identite = page.locator('section').filter({ hasText: 'Identité' });
    await identite.getByRole('button', { name: 'Modifier' }).click();
    const date = identite.getByLabel('Date de mise à mort');
    await date.fill('2025-07-05');
    await date.blur();
    await identite.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('La fiche a été corrigée')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { level: 2 }).locator('..')).toContainText('05/07/2025');

    const premierDetenteur = page.locator('section').filter({ hasText: 'Premier détenteur' });
    await expect(premierDetenteur).toContainText('premier-detenteur@example.fr');
    await premierDetenteur.getByRole('button', { name: 'Modifier' }).click();
    await premierDetenteur.getByLabel('Premier détenteur').selectOption('examinateur@example.fr');
    await premierDetenteur.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(premierDetenteur.getByRole('button', { name: 'Modifier' })).toBeVisible({ timeout: 10000 });
    await expect(premierDetenteur).toContainText('examinateur@example.fr');
    await expect(premierDetenteur).not.toContainText('premier-detenteur@example.fr');
  });

  test("l'admin ajoute puis supprime une carcasse", async ({ page }) => {
    await openAdmin(page, `/app/admin/fei/${feiAuPremierDetenteur}`);
    await page.getByRole('tab', { name: 'Carcasses' }).click();

    await page.getByLabel('Marquage').fill('MM-999');
    await page.getByLabel('Espèce').selectOption('Chevreuil');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    const nouvelleCarcasse = page.getByRole('row').filter({ hasText: 'MM-999' });
    await expect(nouvelleCarcasse).toContainText('Chevreuil', { timeout: 10000 });

    // un numéro déjà utilisé est refusé
    await page.getByLabel('Marquage').fill('MM-999');
    await page.getByLabel('Espèce').selectOption('Chevreuil');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('Le numéro de marquage est déjà utilisé pour cette fiche')).toBeVisible({
      timeout: 10000,
    });

    page.once('dialog', (dialog) => dialog.accept());
    await nouvelleCarcasse.getByRole('button', { name: 'Supprimer la carcasse MM-999' }).click();
    await expect(page.getByText('La carcasse a été supprimée')).toBeVisible({ timeout: 10000 });
    await expect(nouvelleCarcasse.getByRole('button', { name: 'Supprimer la carcasse MM-999' })).toHaveCount(
      0
    );
  });
});

test.describe('fiche clôturée', () => {
  test.beforeEach(async () => {
    await resetDb('SVI_CLOSED');
  });

  test("l'admin ne peut plus corriger une fiche clôturée", async ({ page }) => {
    await openAdmin(page, `/app/admin/fei/${feiCloturee}`);

    await expect(page.getByText('La fiche est clôturée : corrections impossibles')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: 'Modifier' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Carcasses' }).click();
    await expect(page.getByRole('button', { name: 'Ajouter' })).toHaveCount(0);
  });
});
