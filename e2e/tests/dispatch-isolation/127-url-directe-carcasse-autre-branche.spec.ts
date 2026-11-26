import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 127 — URL directe vers carcasse d'une autre branche → page 404.
// Group 1 (ETG 1) keeps MM-001-003/004. Group 2 (ETG 2) gets MM-001-001/002.
// ETG 1 tries to access MM-001-001 (ETG 2's carcasse) via direct URL.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("ETG 1 ne peut pas accéder à la carcasse d'ETG 2 via URL directe", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // Dispatch 2/2
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris', carcasses: [0, 1] });
  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // ETG 1 tente d'ouvrir la carcasse d'ETG 2 (MM-001-001, in group 2) via URL
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');

  // Témoin : la carcasse de sa propre branche (MM-001-003) s'ouvre par URL directe
  await page.goto(`http://localhost:3290/app/etg/carcasse-svi/${feiId}/${feiId}_MM-001-003`);
  await expect(page.getByRole('heading', { level: 1, name: /MM-001-003/ })).toBeVisible({ timeout: 15000 });

  // La carcasse de l'ETG 2 (MM-001-001) n'est jamais envoyée à l'ETG 1 par le serveur : page 404
  await page.goto(`http://localhost:3290/app/etg/carcasse-svi/${feiId}/${feiId}_MM-001-001`);
  await expect(page.getByRole('heading', { name: 'Page non trouvée' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText(/10 pigeons|Pigeons \(10\)/i)).not.toBeVisible();
});
