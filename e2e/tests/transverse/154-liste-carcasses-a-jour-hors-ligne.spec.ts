import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 154 — la liste des carcasses suit les modifications locales faites hors ligne, sans
// attendre un rechargement depuis le serveur.
test('ETG : une carcasse signalée manquante hors ligne apparaît manquante dans la liste des carcasses', async ({
  page,
  context,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/carcasses');
  const row = page.getByRole('row').filter({ hasText: 'MM-001-004' });
  await expect(row).toContainText('Sans décision', { timeout: 10000 });

  // La fiche est ouverte en ligne pour que le serveur de dev ait servi le code de ses deux pages.
  await page.getByRole('link', { name: feiId }).first().click();
  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' });
  await expect(carcasseBtn).toBeVisible({ timeout: 10000 });

  await context.setOffline(true);

  await new Promise((r) => setTimeout(r, 500)); // react-dsfr modal re-render settle
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse manquante').click();
  await expect(page.getByText('Je signale 1 carcasse manquante.')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/);
  await expect(row).toContainText('Manquante');
  await expect(row).not.toContainText('Sans décision');
});
