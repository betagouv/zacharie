import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// La FDC Allier est propriétaire du « CCG Chasseurs » (seed FDC_CCG). Elle voit la fiche déposée dans
// son CCG jusqu'à sa sortie du CCG, mais jamais le devenir des carcasses (refus ETG, saisie SVI).
const FEI_NUMERO = 'ZACH-20250707-QZ6E0-245242';

test.beforeAll(async () => {
  await resetDb('FDC_CCG');
});

test('FDC propriétaire de CCG — voit les fiches déposées dans son CCG, sans leur devenir', async ({
  page,
}) => {
  await connectWith(page, 'fdc@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);

  await page.getByRole('link', { name: 'Mes CCG' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/ccg/);
  await expect(page.getByRole('heading', { name: 'Fiches déposées dans mes CCG' })).toBeVisible();
  const ficheLink = page.getByRole('link', { name: new RegExp(FEI_NUMERO) });
  await expect(ficheLink).toBeVisible({ timeout: 15000 });
  await expect(ficheLink).toContainText('Premier détenteur : Pierre Petit');
  await expect(ficheLink).toContainText('4 carcasses déposées dans CCG Chasseurs');

  await ficheLink.click();
  await expect(page).toHaveURL(new RegExp(`/app/chasseur/ccg/${FEI_NUMERO}`));
  await expect(page.getByRole('heading', { name: `Fiche ${FEI_NUMERO}` })).toBeVisible();
  await expect(page.getByText('Pierre Petit')).toBeVisible();
  await expect(page.getByText('Daim – MM-001-001')).toBeVisible();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await expect(page.getByText(/Déposée dans CCG Chasseurs par le premier détenteur/)).toHaveCount(4);
  await expect(page.getByText(/Sortie du CCG par ETG 1/)).toHaveCount(4);

  // le devenir des carcasses n'est jamais affiché
  await expect(page.getByText(/saisie/i)).toHaveCount(0);
  await expect(page.getByText(/Tuberculose/)).toHaveCount(0);
  await expect(page.getByText(/Carcasse avariée/)).toHaveCount(0);
  await expect(page.getByText(/refus/i)).toHaveCount(0);

  // la fiche n'entre pas dans les fiches de chasseur de la FDC
  await page.getByRole('link', { name: 'Voir toutes les fiches de mes CCG' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/ccg$/);
  await page.getByRole('link', { name: 'Fiches', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chasseur$/);
  await expect(page.getByText(FEI_NUMERO)).toHaveCount(0);
});

test('FDC sans CCG — pas d’onglet « Mes CCG »', async ({ page }) => {
  await resetDb('FDC');
  await connectWith(page, 'fdc@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await expect(page.getByRole('link', { name: 'Tableau de bord Fédération' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('link', { name: 'Mes CCG' })).toHaveCount(0);
});
