import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Empty dashboard — chasseur avec CFEI voit le bouton « Créer une fiche »', async ({ page }) => {
  // L'examinateur seedé a un numero_cfei : sur le tableau de bord vide, il doit voir
  // le bouton « Créer une fiche » et la copie qui parle de fiche d'examen initial.
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/tableau-de-bord');
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord/);

  await expect(page.getByText('Pas encore de carcasses cette saison')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/votre première fiche d'examen initial/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer une fiche' })).toBeVisible();

  // La bottom-nav mobile expose aussi un raccourci « Nouvelle fiche » pour les chasseurs avec CFEI.
  const bottomNav = page.locator('#bottom-navigation');
  await expect(bottomNav.getByText('Nouvelle fiche')).toBeVisible();
});
