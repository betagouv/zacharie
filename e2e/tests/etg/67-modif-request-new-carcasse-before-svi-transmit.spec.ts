import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Ajout carcasse manquante pré-transmission SVI : visible par SVI, pas de boucle ETG', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await expect(addBtn).not.toBeVisible();
});
