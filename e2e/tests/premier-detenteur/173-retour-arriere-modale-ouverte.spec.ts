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

// Sur Android, le bouton « retour » du téléphone quitte la page alors qu'une fenêtre (modale) est ouverte.
// La modale, contenant des boutons radio, disparaissait encore ouverte : le piège à focus DSFR plantait
// (« Cannot read properties of undefined (reading 'keep') »), puis à chaque ouverture/fermeture de page.
test('quitter la fiche avec « retour » pendant que la modale du destinataire est ouverte ne plante pas', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  const pageErrors: Array<string> = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // La raison sociale interroge l'annuaire des entreprises (API externe) : on simule une réponse vide
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );

  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await creerDestinataire(page, 'Ma Boucherie Test');
  await expect(venteDonModal(page).locator('input[type="radio"]').first()).toBeAttached();

  // Bouton « retour » du téléphone, modale ouverte
  await page.goBack();
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });

  // On revient sur la fiche : la modale s'ouvre de nouveau normalement
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await expect(venteDonModal(page).getByText('Prochain détenteur des carcasses').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
