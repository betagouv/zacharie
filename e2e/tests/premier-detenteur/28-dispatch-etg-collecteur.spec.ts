import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';
import { ajouterVenteDon } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch mixte ETG + collecteur : chacun reçoit sa part', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Vente / don 1 : ETG 1, toutes les carcasses par défaut.
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Vente / don 2 : collecteur, qui reprend 2 carcasses à l'ETG 1.
  // Pas d'étape Transport pour un collecteur : il vient chercher les carcasses lui-même.
  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i, carcasses: [0, 1] });

  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // ETG 1 ne voit que 2 carcasses
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible();

  // Collecteur ne voit que 2 carcasses
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible();
});
