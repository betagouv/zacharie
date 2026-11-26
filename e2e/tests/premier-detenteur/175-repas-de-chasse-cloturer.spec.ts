import type { Page } from '@playwright/test';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  venteDonModal,
  selectDestinataire,
  allerAEtape,
  choisirStockage,
  enregistrerVenteDon,
} from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

function boutonFiche(page: Page, action: 'Transmettre' | 'Clôturer') {
  return page.getByRole('button', { name: new RegExp(`^${action}`) });
}

async function expectFicheCloturee(page: Page) {
  await expect(page.getByRole('heading', { name: 'Votre fiche est clôturée' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/notifié|transmise/)).toHaveCount(0);
}

test.describe('Premier détenteur = association', () => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  test.beforeEach(async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR_ASSOCIATION');
    await connectWith(page, 'premier-detenteur@example.fr');
    await page.getByRole('link', { name: feiId }).click();
  });

  test('« Repas de chasse » remplace « Moi-même » et la fiche se clôture', async ({ page }) => {
    await openVenteDon(page);
    const modal = venteDonModal(page);
    await expect(
      modal.getByRole('radio', { name: 'Repas de chasse – Association de chasseurs' })
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(modal.getByRole('radio', { name: /^Moi-même/ })).toHaveCount(0);

    await selectDestinataire(page, 'Repas de chasse – Association de chasseurs');
    await allerAEtape(page, 'Stockage');
    await choisirStockage(page, 'aucun');
    await enregistrerVenteDon(page);

    await expect(page.getByText('Repas de chasse – Association de chasseurs').first()).toBeVisible({
      timeout: 10000,
    });
    const cloturer = boutonFiche(page, 'Clôturer');
    await expect(cloturer).toBeVisible();
    await expect(boutonFiche(page, 'Transmettre')).toHaveCount(0);

    await cloturer.scrollIntoViewIfNeeded();
    await cloturer.click();
    await expect(page).toHaveURL(new RegExp(`/app/chasseur/fei/${feiId}/envoy`), { timeout: 10000 });
    await expectFicheCloturee(page);
  });
});

test.describe('Premier détenteur = moi-même', () => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  test.beforeEach(async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    await connectWith(page, 'premier-detenteur@example.fr');
    await page.getByRole('link', { name: feiId }).click();
  });

  test('« Moi-même » clôture la fiche', async ({ page }) => {
    await openVenteDon(page);
    await expect(venteDonModal(page).getByRole('radio', { name: /^Repas de chasse/ })).toHaveCount(0);
    await selectDestinataire(page, /^Moi-même/);
    await allerAEtape(page, 'Carcasses');
    await enregistrerVenteDon(page);

    const cloturer = boutonFiche(page, 'Clôturer');
    await expect(cloturer).toBeVisible({ timeout: 10000 });
    await expect(boutonFiche(page, 'Transmettre')).toHaveCount(0);

    await cloturer.scrollIntoViewIfNeeded();
    await cloturer.click();
    await expect(page).toHaveURL(new RegExp(`/app/chasseur/fei/${feiId}/envoy`), { timeout: 10000 });
    await expectFicheCloturee(page);
  });

  test('Un autre destinataire garde « Transmettre »', async ({ page }) => {
    await openVenteDon(page);
    await selectDestinataire(page, /Commerce de Détail 1/);
    await allerAEtape(page, 'Stockage');
    await choisirStockage(page, 'aucun');
    await enregistrerVenteDon(page);

    await expect(boutonFiche(page, 'Transmettre')).toBeVisible({ timeout: 10000 });
    await expect(boutonFiche(page, 'Clôturer')).toHaveCount(0);
  });
});
