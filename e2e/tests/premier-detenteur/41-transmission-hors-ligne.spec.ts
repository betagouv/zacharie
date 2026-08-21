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

test('Transmission hors-ligne — sync auto au retour en ligne', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Hors-ligne
  await context.setOffline(true);

  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  // UI locale affiche le succès local (pas de beacon serveur)
  await expect(page.getByText(/transmise|synchronisation|hors.?ligne/i).first()).toBeVisible({
    timeout: 10000,
  });

  // Retour online
  await context.setOffline(false);

  // Sync attendue — reconnect ETG 1
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
