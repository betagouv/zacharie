import { test, expect } from '../../utils/test';
import type { Browser } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 52 — Un CCG pré-enregistré n'est modifiable que par le chasseur qui l'a créé.
// Un autre chasseur qui s'y rattache avec le même numéro le voit dans sa liste, sans pouvoir le renommer.

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

// Chaque chasseur agit dans son propre navigateur, avec son propre cookie de session.
async function chasseurPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    viewport: { width: 350, height: 667 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await connectWith(page, email);
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  return page;
}

test('52 - seul le créateur d’un CCG pré-enregistré peut le modifier', async ({ browser }) => {
  const createur = await chasseurPage(browser, 'premier-detenteur@example.fr');
  const creation = await createur.request.post(`${API_URL}/entite/ccg`, { data: ccgBody });
  expect(creation.status()).toBe(200);
  const ccgId = (await creation.json()).data.createdEntity.id as string;

  const autre = await chasseurPage(browser, 'examinateur@example.fr');
  const rattachement = await autre.request.post(`${API_URL}/entite/ccg`, { data: ccgBody });
  expect(rattachement.status()).toBe(200);
  expect((await rattachement.json()).data.createdEntity.id).toBe(ccgId);

  // Le chasseur rattaché voit le CCG, sans bouton « Éditer »
  await autre.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  const carteAutre = autre.locator('div.rounded', { hasText: numeroCCG });
  await expect(carteAutre).toBeVisible({ timeout: 10000 });
  await expect(carteAutre.getByRole('button', { name: 'Supprimer' })).toBeVisible();
  await expect(carteAutre.getByRole('button', { name: 'Éditer' })).toHaveCount(0);

  // La page d'édition est en lecture seule et l'API refuse la modification
  await autre.goto(`http://localhost:3290/app/chasseur/profil/ccgs/${ccgId}`);
  await expect(
    autre.getByText('Seul le chasseur qui a pré-enregistré cette chambre froide peut la modifier.')
  ).toBeVisible({ timeout: 10000 });
  await expect(autre.getByRole('button', { name: 'Enregistrer les modifications' })).toHaveCount(0);
  const renommage = await autre.request.put(`${API_URL}/entite/ccg/${ccgId}`, {
    data: { ...ccgBody, nom_d_usage: 'Nom modifié par un autre' },
  });
  expect(renommage.status()).toBe(403);

  // Le créateur garde la main
  await createur.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  const carteCreateur = createur.locator('div.rounded', { hasText: numeroCCG });
  await expect(carteCreateur.getByText('Chambre froide partagée')).toBeVisible({ timeout: 10000 });
  await expect(carteCreateur.getByRole('button', { name: 'Éditer' })).toBeVisible();
  const modification = await createur.request.put(`${API_URL}/entite/ccg/${ccgId}`, {
    data: { ...ccgBody, nom_d_usage: 'Chambre froide renommée' },
  });
  expect(modification.status()).toBe(200);
});
