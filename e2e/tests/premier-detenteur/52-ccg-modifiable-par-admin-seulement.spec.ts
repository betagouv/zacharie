import { test, expect } from '../../utils/test';
import type { Browser } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { changeReactSelectValue } from '../../utils/react-select';

// Scenario 52 — Un CCG pré-enregistré n'est modifiable que par son admin, nommé par l'équipe Zacharie.
// Le chasseur qui le pré-enregistre et celui qui s'y rattache avec le même numéro en sont membres :
// ils le voient dans leur liste, sans pouvoir le renommer.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const API_URL = 'http://localhost:3291';
const numeroCCG = '86-CCG-52';
const ccgBody = {
  nom_d_usage: 'Chambre froide partagée',
  address_ligne_1: '1 rue du Bois',
  address_ligne_2: '',
  code_postal: '86000',
  ville: 'Poitiers',
  siret: '',
  numero_ddecpp: numeroCCG,
};

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// Chaque utilisateur agit dans son propre navigateur, avec son propre cookie de session.
async function chasseurPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    viewport: { width: 350, height: 667 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await connectWith(page, email);
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  return { context, page };
}

// /app/admin exige ProConnect en plus du login mot de passe (voir 136).
async function adminPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin/, { timeout: 10000 });
  return { context, page };
}

test('52 - seul l’admin d’un CCG pré-enregistré, nommé par l’équipe Zacharie, peut le modifier', async ({
  browser,
}) => {
  const { context: createurContext, page: createur } = await chasseurPage(
    browser,
    'premier-detenteur@example.fr'
  );
  const creation = await createur.request.post(`${API_URL}/entite/ccg`, { data: ccgBody });
  expect(creation.status()).toBe(200);
  const ccgId = (await creation.json()).data.createdEntity.id as string;

  const { context: autreContext, page: autre } = await chasseurPage(browser, 'examinateur@example.fr');
  const rattachement = await autre.request.post(`${API_URL}/entite/ccg`, { data: ccgBody });
  expect(rattachement.status()).toBe(200);
  expect((await rattachement.json()).data.createdEntity.id).toBe(ccgId);

  // Ni le chasseur qui l'a pré-enregistré, ni celui qui s'y est rattaché n'ont le bouton « Éditer »
  for (const chasseur of [createur, autre]) {
    await chasseur.goto('http://localhost:3290/app/chasseur/profil/ccgs');
    const carte = chasseur.locator('div.rounded', { hasText: numeroCCG });
    await expect(carte).toBeVisible({ timeout: 10000 });
    await expect(carte.getByRole('button', { name: 'Supprimer' })).toBeVisible();
    await expect(carte.getByRole('button', { name: 'Éditer' })).toHaveCount(0);
  }

  // La page d'édition est en lecture seule et l'API refuse la modification
  await createur.goto(`http://localhost:3290/app/chasseur/profil/ccgs/${ccgId}`);
  await expect(
    createur.getByText(
      "Seul l'administrateur de cette chambre froide, désigné par l'équipe Zacharie, peut la modifier."
    )
  ).toBeVisible({ timeout: 10000 });
  await expect(createur.getByRole('button', { name: 'Enregistrer les modifications' })).toHaveCount(0);
  for (const chasseur of [createur, autre]) {
    const renommage = await chasseur.request.put(`${API_URL}/entite/ccg/${ccgId}`, {
      data: { ...ccgBody, nom_d_usage: 'Nom modifié par un membre' },
    });
    expect(renommage.status()).toBe(403);
  }

  // L'équipe Zacharie nomme le premier détenteur admin du CCG
  const { context: adminContext, page: admin } = await adminPage(browser);
  await admin.goto('http://localhost:3290/app/admin/user/0Y545');
  await admin.getByRole('tab', { name: /CCGs/ }).click();
  await expect(admin.locator('.select-relation-status__single-value')).toHaveText('Membre', {
    timeout: 10000,
  });
  await changeReactSelectValue(admin, 'select-relation-status', 'Admin');
  await expect(admin.locator('.select-relation-status__single-value')).toHaveText('Admin');

  // L'admin du CCG peut le modifier, l'autre chasseur toujours pas
  await createur.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  const carteAdmin = createur.locator('div.rounded', { hasText: numeroCCG });
  await expect(carteAdmin.getByRole('button', { name: 'Éditer' })).toBeVisible({ timeout: 10000 });
  const modification = await createur.request.put(`${API_URL}/entite/ccg/${ccgId}`, {
    data: { ...ccgBody, nom_d_usage: 'Chambre froide renommée' },
  });
  expect(modification.status()).toBe(200);
  const renommageAutre = await autre.request.put(`${API_URL}/entite/ccg/${ccgId}`, {
    data: { ...ccgBody, nom_d_usage: 'Nom modifié par un membre' },
  });
  expect(renommageAutre.status()).toBe(403);

  await adminContext.close();
  await autreContext.close();
  await createurContext.close();
});
