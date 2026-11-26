import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { openVenteDon, venteDonModal } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const feiId = 'ZACH-20250707-QZ6E0-155242';

test.beforeEach(async ({ page }) => {
  await resetDb('PREMIER_DETENTEUR_SANS_DESTINATAIRE');
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
});

test('Sans destinataire habituel, « Moi-même » est proposé directement', async ({ page }) => {
  const modal = venteDonModal(page);

  const moiMeme = modal.getByRole('radio', { name: /^Moi-même/ });
  await expect(moiMeme).toBeVisible({ timeout: 10000 });
  await expect(modal.getByRole('radio')).toHaveCount(1);
  await expect(modal.getByPlaceholder('Tapez le nom du destinataire')).toHaveCount(0);

  const moiMemeLabel = modal.locator(`label[for="${await moiMeme.getAttribute('id')}"]`);
  await moiMemeLabel.scrollIntoViewIfNeeded();
  await moiMemeLabel.click();
  await expect(moiMeme).toBeChecked();
});

test('Sans destinataire habituel, « Envoyer à un autre destinataire » ouvre la recherche', async ({
  page,
}) => {
  const modal = venteDonModal(page);

  const autreDestinataire = modal.getByRole('button', { name: 'Envoyer à un autre destinataire' });
  await autreDestinataire.scrollIntoViewIfNeeded();
  await autreDestinataire.click();

  await expect(modal.getByRole('radio', { name: /^Moi-même/ })).toHaveCount(0);
  const recherche = modal.getByPlaceholder('Tapez le nom du destinataire');
  await expect(recherche).toBeVisible();

  await recherche.fill('etg 1');
  const resultat = modal.getByRole('button', { name: /^ETG 1 - 75000 Paris/ });
  await resultat.scrollIntoViewIfNeeded();
  await resultat.click();
  await expect(recherche).toHaveValue(/^ETG 1 - 75000 Paris/);
});
