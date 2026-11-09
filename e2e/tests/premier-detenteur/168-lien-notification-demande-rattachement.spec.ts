import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// Seed : « Association de chasseurs » a deux admins, premier-detenteur@ et examinateur-premier-detenteur@.
const ASSOCIATION = 'Association de chasseurs';
const ASSOCIATION_ID = '5b916331-632e-4c29-be2e-12a834e92688';
// Lien du mail et de la notification push envoyés aux admins quand un chasseur demande à rejoindre
// l'association (cf. api-express/src/controllers/user-entity.ts).
const NOTIFICATION_PATH = `/app/chasseur/profil/informations-de-chasse?open-entity=${ASSOCIATION_ID}`;

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Le lien de la notification ouvre les utilisateurs de l’association sur « Informations de chasse »', async ({
  page,
}) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });

  await page.goto(`http://localhost:3290${NOTIFICATION_PATH}`);

  await expect(page).toHaveURL(/\/app\/chasseur\/profil\/informations-de-chasse/);
  const usersDialog = page.getByRole('dialog', { name: new RegExp(ASSOCIATION) });
  await expect(usersDialog).toBeVisible({ timeout: 10000 });
  await expect(usersDialog.getByText('examinateur-premier-detenteur@example.fr')).toBeVisible();
});
