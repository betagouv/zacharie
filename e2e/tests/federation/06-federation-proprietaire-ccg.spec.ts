import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// seed FEDERATION_CCG : fnc@ (rôle FEDERATION) et fdc@ (chasseur) sont propriétaires du « CCG Chasseurs »
const FEI_NUMERO = 'ZACH-20250707-QZ6E0-245242';

test.beforeEach(async () => {
  await resetDb('FEDERATION_CCG');
});

test('Fédération propriétaire de CCG — voit les fiches déposées dans son CCG, sans leur devenir', async ({
  page,
}) => {
  await connectWith(page, 'fnc@example.fr');
  await expect(page).toHaveURL(/\/app\/federation/);

  await page.getByRole('link', { name: 'Mes fiches' }).click();
  await expect(page).toHaveURL(/\/app\/federation\/fiches/);
  const ficheLink = page.locator(`a[href$="/${FEI_NUMERO}"]`);
  await expect(ficheLink).toBeVisible({ timeout: 15000 });
  await expect(ficheLink).toContainText('Déposée au CCG');
  await expect(ficheLink).toContainText('Pierre Petit');

  await ficheLink.click();
  await expect(page).toHaveURL(new RegExp(`/app/federation/fiches/${FEI_NUMERO}`));
  await expect(page.getByRole('heading', { name: `Fiche ${FEI_NUMERO}` })).toBeVisible();
  await expect(page.getByText('Pierre Petit')).toBeVisible();
  await expect(page.getByText('Daim – MM-001-001')).toBeVisible();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await expect(page.getByText(/Déposée dans CCG Chasseurs par le premier détenteur/)).toHaveCount(4);
  await expect(page.getByText(/Sortie du CCG par ETG 1/)).toHaveCount(4);

  await expect(page.getByText(/saisie/i)).toHaveCount(0);
  await expect(page.getByText(/Tuberculose/)).toHaveCount(0);
  await expect(page.getByText(/Carcasse avariée/)).toHaveCount(0);
  await expect(page.getByText(/refus/i)).toHaveCount(0);

  await page.getByRole('link', { name: 'Retour aux fiches' }).click();
  await expect(page).toHaveURL(/\/app\/federation\/fiches$/);
});

test('Chasseur propriétaire de CCG — voit les fiches de son CCG dans « Fiches », sans leur devenir', async ({
  page,
}) => {
  await connectWith(page, 'fdc@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/chasseur');
  const ficheLink = page.locator(`a[href="/app/chasseur/ccg/${FEI_NUMERO}"]`);
  await expect(ficheLink).toBeVisible({ timeout: 15000 });
  await expect(ficheLink).toContainText('Déposée au CCG');
  await expect(page.getByText('Pas encore de fiches cette saison')).toHaveCount(0);
  await ficheLink.click();
  await expect(page).toHaveURL(new RegExp(`/app/chasseur/ccg/${FEI_NUMERO}`));
  await expect(page.getByText(/Sortie du CCG par ETG 1/)).toHaveCount(4);
  await expect(page.getByText(/saisie/i)).toHaveCount(0);
  await expect(page.getByText(/refus/i)).toHaveCount(0);

  await page.getByRole('link', { name: 'Retour aux fiches' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur$/);
});
