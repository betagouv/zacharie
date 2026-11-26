import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("ETG 1 ne peut pas accéder à la carcasse d'ETG 2 via URL directe", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris', carcasses: [0, 1] });
  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');

  await page.goto(`http://localhost:3290/app/etg/carcasse-svi/${feiId}/${feiId}_MM-001-001`);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  await expect(page.getByText(/10 pigeons|Pigeons \(10\)/i)).not.toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
});
