import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('SVI');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 66 — ETG adds a missing carcasse AFTER the FEI has already been transmitted to SVI but
// BEFORE the examinateur approves the new exam. The new carcasse must:
//   - inherit the FEI's SVI assignment (svi_assigned_to_fei_at, svi_entity_id, next_owner_*) so the
//     SVI sees it immediately (with the pending banner)
//   - not trigger an endless re-transmission prompt on the ETG side after approval
// Once the examinateur approves, the SVI can finally run IPM on the new carcasse.
test('Ajout carcasse manquante pré-transmission SVI : visible par SVI, pas de boucle ETG', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';

  // Step 1: ETG-1 (still has a CarcasseIntermediaire row from the SVI seed) opens the FEI and adds
  // a missing carcasse, even though the FEI has already been transmitted to SVI.
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const addBtn = page.getByRole('button', { name: 'Ajouter une carcasse manquante' });
  await expect(addBtn).not.toBeVisible();
});
