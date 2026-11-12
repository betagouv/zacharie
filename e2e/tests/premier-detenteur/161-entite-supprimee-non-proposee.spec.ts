import { test, expect } from '../../utils/test';
import type { Browser, Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  ajouterVenteDon,
  openVenteDon,
  ouvrirRechercheDestinataire,
  venteDonModal,
} from '../../utils/vente-don';

// Scenario 161 — Un admin supprime une entité que le premier détenteur a dans sa copie locale.
// En ligne, elle disparaît de la liste des destinataires au prochain chargement. Hors ligne, il peut
// encore la choisir : le serveur refuse alors la transmission et le chasseur en est prévenu.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const API_URL = 'http://localhost:3291';
const feiId = 'ZACH-20250707-QZ6E0-155242';
const commerceId = 'b5d31c7f-5e5a-4c2c-9e37-1e6b2d8c4f10';
const commerceNom = /Commerce de Détail 1/i;

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// L'admin agit dans son propre navigateur : la copie locale du chasseur reste intacte.
// /app/admin exige ProConnect en plus du login mot de passe (voir 136).
async function supprimerCommerceDepuisAdmin(browser: Browser) {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await connectWith(adminPage, 'admin@example.fr');
  await expect(adminPage).toHaveURL(/\/app\/chasseur/);
  await adminPage.goto('http://localhost:3290/app/admin');
  await expect(adminPage).toHaveURL(/\/app\/proconnect\?redirect=/);
  await adminPage.locator('a[href*="/user/proconnect/start"]').click();
  await adminPage.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(adminPage).toHaveURL(/\/app\/admin/, { timeout: 10000 });
  const softDelete = await adminPage.request.post(`${API_URL}/admin/entity/${commerceId}/soft-delete`);
  expect(softDelete.status()).toBe(200);
  await adminContext.close();
}

async function rechercherDestinataire(page: Page, nom: string) {
  await openVenteDon(page);
  await expect(venteDonModal(page).getByText('Prochain détenteur des carcasses').first()).toBeVisible({
    timeout: 10000,
  });
  const recherche = await ouvrirRechercheDestinataire(page);
  await recherche.fill(nom);
}

test("161 - une entité supprimée par l'admin n'est plus proposée comme destinataire", async ({
  page,
  browser,
}) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await rechercherDestinataire(page, 'Commerce de Détail 1');
  await expect(venteDonModal(page).getByRole('button', { name: commerceNom })).toBeVisible({
    timeout: 10000,
  });

  await supprimerCommerceDepuisAdmin(browser);

  // Recharger garde la copie locale (IndexedDB) : seul le chargement des relations peut la purger
  await page.reload();
  await rechercherDestinataire(page, 'Commerce de Détail 1');
  await expect(
    venteDonModal(page).getByRole('button', { name: 'Créer « Commerce de Détail 1 »' })
  ).toBeVisible({
    timeout: 10000,
  });
  // ancré au début : « Créer « Commerce de Détail 1 » » contient aussi le nom
  await expect(venteDonModal(page).getByRole('button', { name: /^Commerce de Détail 1/i })).toHaveCount(0, {
    timeout: 10000,
  });
});

test('161 - une transmission hors ligne vers une entité supprimée est refusée', async ({
  page,
  context,
  browser,
}) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: /Ajouter un destinataire/i }).first()).toBeVisible({
    timeout: 10000,
  });

  await context.setOffline(true);
  await supprimerCommerceDepuisAdmin(browser);

  // Hors ligne, la copie locale propose encore le commerce
  await ajouterVenteDon(page, { destinataire: commerceNom });
  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  await context.setOffline(false);
  await expect(page.getByText('Cette entité a été supprimée, choisissez-en une autre')).toBeVisible({
    timeout: 15000,
  });
});
