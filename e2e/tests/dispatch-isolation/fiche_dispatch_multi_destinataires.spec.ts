import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch 4 carcasses vers 2 destinataires ETG', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. Premier détenteur prend en charge
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('link', { name: feiId }).click();

  // 2. Vente / don 1 : ETG 1 (toutes les carcasses par défaut)
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // 3. Vente / don 2 : ETG 2, qui reprend 2 carcasses à l'ETG 1
  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0, 1] });

  // 4. Vérifier les compteurs de chaque carte
  await expect(page.getByText('1 carcasse + 1 lot')).toBeVisible();
  await expect(page.getByText('2 carcasses')).toBeVisible();

  // 5. Soumettre
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ETG 1.*1 carcasse \+ 1 lot/)).toBeVisible();
  await expect(page.getByText(/ETG 2.*2 carcasse/)).toBeVisible();

  // 10. Connecter en tant que ETG 1 et vérifier qu'il ne voit que 2 carcasses
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();

  await page.goto('http://localhost:3290/app/connexion', { timeout: 10000 });
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  // Verify the section title shows "Carcasses (2)" not "Carcasses (4)"
  await expect(page.getByText('Carcasses (2)')).toBeVisible();

  // Le bouton de prise en charge doit être visible
  const priseEnChargeBtn = page.getByRole('button', { name: 'Prendre en charge' });
  await expect(priseEnChargeBtn).toBeVisible();
  await priseEnChargeBtn.click();

  // Après la prise en charge, le bouton doit disparaître
  await expect(priseEnChargeBtn).not.toBeVisible({ timeout: 10000 });
  // After take-charge, should still see only 2 carcasses in the intermediaire section
  await expect(page.getByText('Carcasses (2)')).toBeVisible();

  // 11. Connecter en tant que ETG 2 et vérifier qu'il ne voit que 2 carcasses
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.goto('http://localhost:3290/app/connexion', { timeout: 10000 });
  await connectWith(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible();
  const priseEnChargeBtn2 = page.getByRole('button', { name: 'Prendre en charge' });
  await expect(priseEnChargeBtn2).toBeVisible();
  await priseEnChargeBtn2.click();
  await expect(priseEnChargeBtn2).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Carcasses (2)')).toBeVisible();
});
