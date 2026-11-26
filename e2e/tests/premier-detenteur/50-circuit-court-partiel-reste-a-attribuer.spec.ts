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

test("Vente d'une partie des carcasses au commerce de détail : le reste peut encore être réparti", async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: /Commerce de Détail 1/i, carcasses: [0] });
  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Commerce de Détail 1 a été notifié/i).first()).toBeVisible({
    timeout: 10000,
  });

  const attribuerRestantes = page.getByRole('link', { name: 'Attribuer les carcasses restantes' });
  await attribuerRestantes.scrollIntoViewIfNeeded();
  await attribuerRestantes.click();

  await expect(page.getByTitle('Supprimer la carcasse')).toHaveCount(3, { timeout: 10000 });

  await ajouterVenteDon(page, { destinataire: /ETG 1 - 75000 Paris/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise aux 2 destinataires/i).first()).toBeVisible({
    timeout: 10000,
  });

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (3)')).toBeVisible({ timeout: 10000 });
});
