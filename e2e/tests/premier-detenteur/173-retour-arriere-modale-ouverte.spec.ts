import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { openVenteDon, venteDonModal, creerDestinataire } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('quitter la fiche avec « retour » pendant que la modale du destinataire est ouverte ne plante pas', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  const pageErrors: Array<string> = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );

  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await creerDestinataire(page, 'Ma Boucherie Test');
  await expect(venteDonModal(page).locator('input[type="radio"]').first()).toBeAttached();

  await page.goBack();
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await expect(venteDonModal(page).getByText('Prochain détenteur des carcasses').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
