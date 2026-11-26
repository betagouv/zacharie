import { test, expect } from '../../utils/test';
import type { Browser, Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const ASSOCIATION = 'Association de chasseurs';
const FEI_ID = 'ZACH-20250707-ASSO1-165245';
const PROFIL_URL = 'http://localhost:3290/app/chasseur/profil/informations-de-chasse';
const FICHES_URL = 'http://localhost:3290/app/chasseur';

test.beforeAll(async () => {
  await resetDb('ASSOCIATION_FICHE_EXISTANTE');
});

function waitForCarcassesPull(page: Page) {
  return page.waitForResponse((res) => new URL(res.url()).pathname === '/carcasse' && res.ok(), {
    timeout: 15000,
  });
}

function associationCard(page: Page) {
  return page.locator('.bg-contrast-grey').filter({ hasText: ASSOCIATION }).first();
}

async function adminValideLaDemande(browser: Browser) {
  const adminContext = await browser.newContext({
    viewport: { width: 350, height: 667 },
    hasTouch: true,
    isMobile: true,
  });
  const adminPage = await adminContext.newPage();
  await connectWith(adminPage, 'premier-detenteur@example.fr');
  await expect(adminPage).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  await adminPage.goto(PROFIL_URL);
  const voirUtilisateurs = associationCard(adminPage).getByRole('button', { name: 'Voir les utilisateurs' });
  await voirUtilisateurs.scrollIntoViewIfNeeded();
  await voirUtilisateurs.click();
  const usersDialog = adminPage.getByRole('dialog', { name: new RegExp(ASSOCIATION) });
  await expect(usersDialog).toBeVisible({ timeout: 10000 });
  const demandeRow = usersDialog.locator('.bg-contrast-grey').filter({ hasText: 'examinateur@example.fr' });
  const validation = adminPage.waitForResponse(
    (res) => res.url().includes('/user-entity') && res.request().method() === 'PUT' && res.ok()
  );
  await demandeRow.locator('.select-relation-status__dropdown-indicator').click();
  await adminPage.locator('.select-relation-status__menu').getByText('Membre', { exact: true }).click();
  await validation;
  await adminContext.close();
}

test('Rejoindre une association fait apparaître ses fiches, la quitter les fait disparaître', async ({
  page,
  browser,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  const firstPull = waitForCarcassesPull(page);
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });

  await firstPull;
  await expect(page.getByRole('link', { name: FEI_ID })).toHaveCount(0);

  await page.goto(PROFIL_URL);
  await page
    .getByRole('group', { name: /Êtes-vous rattaché à une association/ })
    .locator('label.fr-label:has-text("Oui")')
    .click();
  await expect(page.getByText(/Rechercher une association, société ou domaine de chasse/i)).toBeVisible({
    timeout: 5000,
  });
  await page.locator("[class*='raison_sociale'][class*='input-container']").first().click();
  await page.getByRole('option', { name: new RegExp(ASSOCIATION) }).click();
  const attachBtn = page.getByRole('button', { name: /Me rattacher à cette entité/i });
  await attachBtn.scrollIntoViewIfNeeded();
  await attachBtn.click();
  await expect(page.getByText('En attente de validation')).toBeVisible({ timeout: 10000 });

  await adminValideLaDemande(browser);

  await page.goto(FICHES_URL);
  await expect(page.getByRole('link', { name: FEI_ID })).toBeVisible({ timeout: 15000 });

  await page.goto(PROFIL_URL);
  const retirer = associationCard(page).getByRole('button', { name: 'Retirer' });
  await retirer.scrollIntoViewIfNeeded();
  await retirer.click();
  await expect(associationCard(page)).toHaveCount(0, { timeout: 10000 });

  const pullAfterLeave = waitForCarcassesPull(page);
  await page.goto(FICHES_URL);
  await pullAfterLeave;
  await expect(page.getByRole('link', { name: FEI_ID })).toHaveCount(0, { timeout: 15000 });
});
