import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 130 — Même examen initial, deux transmissions qui convergent vers le MÊME ETG :
//   - branche directe   : CHASSEUR → ETG 1            (MM-001-003, MM-001-004)
//   - branche collecteur : CHASSEUR → Collecteur Pro 1 → ETG 1  (MM-001-001, MM-001-002)
// L'ETG 1 doit voir 2 cartes de transmission distinctes pour cette fiche, et chaque
// transmission ne contient QUE ses carcasses (pas toutes celles de l'examen).
// Régression du collecteur : l'intermédiaire (Collecteur Pro 1) ne doit apparaître que
// sur la branche qui est réellement passée par lui — pas sur la branche directe.

test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('ETG 1 voit 2 transmissions isolées pour le même examen initial', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. Le PD prend en charge et dispatche en 2 groupes.
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  // Groupe 1 (branche directe) → ETG 1, garde MM-001-003 / MM-001-004.
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const g1Stockage = page.getByText('Pas de stockage').first();
  await g1Stockage.scrollIntoViewIfNeeded();
  await g1Stockage.click();
  const g1Transport = page.getByText('Je transporte les carcasses moi').first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  // Ajouter le groupe 2.
  const ajouterBtn = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  // Déplacer MM-001-001 / MM-001-002 dans le groupe 2.
  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  // Groupe 2 (branche collecteur) → Collecteur Pro 1.
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /Collecteur Pro 1/i }).click();
  const g2Stockage = group2.getByText('Pas de stockage').first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  // Pas d'étape de transport quand on transmet à un collecteur : il gère le transport.

  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. Le Collecteur Pro 1 prend en charge sa branche et la transmet à ETG 1.
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/, { timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ }).click();
  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  const collecteurStockage = page.getByText('Pas de stockage').first();
  await collecteurStockage.scrollIntoViewIfNeeded();
  await collecteurStockage.click();
  const transmettreCollecteur = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreCollecteur.scrollIntoViewIfNeeded();
  await transmettreCollecteur.click();
  await expect(page.getByText(/ETG 1.*notifié|fiche.*transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 3. L'ETG 1 voit 2 cartes de transmission pour le MÊME examen initial.
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  const feiCards = page.getByRole('link', { name: feiId });
  await expect(feiCards).toHaveCount(2, { timeout: 15000 });

  // Le détenteur précédent porté par chaque carte distingue les 2 branches :
  // la branche collecteur affiche « Collecteur Pro 1 », la branche directe ne le mentionne pas.
  // (Avant le fix, l'intermédiaire collecteur fuitait sur TOUTES les transmissions de la fiche.)
  await expect(feiCards.filter({ hasText: 'Collecteur Pro 1' })).toHaveCount(1);
  await expect(feiCards.filter({ hasNotText: 'Collecteur Pro 1' })).toHaveCount(1);

  // 4. Branche collecteur : ne contient QUE MM-001-001 / MM-001-002.
  await feiCards.filter({ hasText: 'Collecteur Pro 1' }).click();
  const priseEnChargeCollecteur = page.getByRole('button', { name: 'Prendre en charge les carcasses' });
  await priseEnChargeCollecteur.scrollIntoViewIfNeeded();
  await priseEnChargeCollecteur.click();
  await expect(priseEnChargeCollecteur).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();

  // 5. Branche directe : ne contient QUE MM-001-003 / MM-001-004.
  await page.goto('http://localhost:3290/app/etg');
  const feiCardsAgain = page.getByRole('link', { name: feiId });
  await expect(feiCardsAgain).toHaveCount(2, { timeout: 15000 });
  await feiCardsAgain.filter({ hasNotText: 'Collecteur Pro 1' }).click();
  const priseEnChargeDirecte = page.getByRole('button', { name: 'Prendre en charge les carcasses' });
  await priseEnChargeDirecte.scrollIntoViewIfNeeded();
  await priseEnChargeDirecte.click();
  await expect(priseEnChargeDirecte).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();
});
