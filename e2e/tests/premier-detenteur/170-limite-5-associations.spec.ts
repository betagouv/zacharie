import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 170 — Un chasseur est rattaché à 5 associations de chasse au maximum (demandes en attente
// comprises). Seed CHASSEUR_5_ASSOCIATIONS : examinateur@ est admin de « Association limite 1 » à 4,
// et a une demande en attente pour « Association limite 5 ».

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const PROFIL_URL = 'http://localhost:3290/app/chasseur/profil/informations-de-chasse';
const LIMIT_TEXT = /Vous êtes rattaché à 5 associations de chasse, le maximum possible/i;

test.beforeEach(async () => {
  await resetDb('CHASSEUR_5_ASSOCIATIONS');
});

test("170 - à 5 associations, le chasseur ne peut plus en ajouter tant qu'il n'en retire pas une", async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  await page.goto(PROFIL_URL);

  await expect(page.getByText('Association limite 5')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(LIMIT_TEXT)).toBeVisible();
  await expect(page.getByRole('button', { name: /Me rattacher à une autre entité/i })).toHaveCount(0);

  // retirer une association libère une place
  const card = page.locator('.bg-contrast-grey').filter({ hasText: 'Association limite 1' }).first();
  const retirer = card.getByRole('button', { name: 'Retirer' });
  await retirer.scrollIntoViewIfNeeded();
  await retirer.click();
  await expect(card).toHaveCount(0, { timeout: 10000 });

  await expect(page.getByText(LIMIT_TEXT)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Me rattacher à une autre entité/i })).toBeVisible({
    timeout: 10000,
  });
});
