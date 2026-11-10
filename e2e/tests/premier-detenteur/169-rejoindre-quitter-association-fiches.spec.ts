import { test, expect } from '../../utils/test';
import type { Browser, Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 169 — Un chasseur rejoint une association : les fiches existantes de l'association
// arrivent sur son appareil. Il la quitte : elles en disparaissent. Le chasseur garde sa session
// (et sa copie locale) d'un bout à l'autre : c'est le rechargement complet demandé par le serveur
// (User.carcasses_reload_version) qui met sa copie locale à jour, pas une nouvelle connexion.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// Seed ASSOCIATION_FICHE_EXISTANTE : « Association de chasseurs » a deux admins, premier-detenteur@ et
// examinateur-premier-detenteur@, et une fiche où examinateur@ n'apparaît pas.
const ASSOCIATION = 'Association de chasseurs';
const FEI_ID = 'ZACH-20250707-ASSO1-165245';
const PROFIL_URL = 'http://localhost:3290/app/chasseur/profil/informations-de-chasse';
const FICHES_URL = 'http://localhost:3290/app/chasseur';

test.beforeAll(async () => {
  await resetDb('ASSOCIATION_FICHE_EXISTANTE');
});

// pull GET /carcasse : une absence n'est vérifiée qu'une fois le pull revenu, sinon elle passe à vide
function waitForCarcassesPull(page: Page) {
  return page.waitForResponse((res) => new URL(res.url()).pathname === '/carcasse' && res.ok(), {
    timeout: 15000,
  });
}

function associationCard(page: Page) {
  return page.locator('.bg-contrast-grey').filter({ hasText: ASSOCIATION }).first();
}

// L'admin valide la demande dans son propre navigateur : la copie locale du chasseur reste intacte.
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

  // avant : la fiche de l'association n'est pas sur l'appareil
  await firstPull;
  await expect(page.getByRole('link', { name: FEI_ID })).toHaveCount(0);

  // demande de rattachement
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

  // validation par un admin de l'association
  await adminValideLaDemande(browser);

  // après : la fiche arrive sur l'appareil du chasseur au rechargement de la page
  await page.goto(FICHES_URL);
  await expect(page.getByRole('link', { name: FEI_ID })).toBeVisible({ timeout: 15000 });

  // le chasseur quitte l'association
  await page.goto(PROFIL_URL);
  const retirer = associationCard(page).getByRole('button', { name: 'Retirer' });
  await retirer.scrollIntoViewIfNeeded();
  await retirer.click();
  await expect(associationCard(page)).toHaveCount(0, { timeout: 10000 });

  // la fiche disparaît de l'appareil au rechargement de la page
  const pullAfterLeave = waitForCarcassesPull(page);
  await page.goto(FICHES_URL);
  await pullAfterLeave;
  await expect(page.getByRole('link', { name: FEI_ID })).toHaveCount(0, { timeout: 15000 });
});
