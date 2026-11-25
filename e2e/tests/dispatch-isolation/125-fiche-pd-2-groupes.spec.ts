import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';

test.setTimeout(120_000);

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('PD voit la fiche avec les 2 groupes clairement identifiés après dispatch', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris', carcasses: [0, 1] });
  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  await expect(page.getByText(/ETG 1.*1 carcasse \+ 1 lot/)).toBeVisible();
  await expect(page.getByText(/ETG 2.*2 carcasses/)).toBeVisible();
});
