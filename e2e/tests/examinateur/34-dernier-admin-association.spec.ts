import { type Page } from '@playwright/test';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// Seed : « Association de chasseurs » a deux admins, premier-detenteur@ et examinateur-premier-detenteur@.
const PROFIL_URL = 'http://localhost:3290/app/chasseur/profil/informations-de-chasse';
const ASSOCIATION = 'Association de chasseurs';

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// accepte toutes les boîtes de dialogue (confirm / alert) et garde leurs messages
function acceptAndRecordDialogs(page: Page) {
  const messages: string[] = [];
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  return messages;
}

function associationCard(page: Page) {
  return page.locator('.bg-contrast-grey').filter({ hasText: ASSOCIATION }).first();
}

async function openUsersDialog(page: Page) {
  await page.goto(PROFIL_URL);
  const voirUtilisateurs = associationCard(page).getByRole('button', { name: 'Voir les utilisateurs' });
  await voirUtilisateurs.scrollIntoViewIfNeeded();
  await voirUtilisateurs.click();
  const usersDialog = page.getByRole('dialog', { name: new RegExp(ASSOCIATION) });
  await expect(usersDialog).toBeVisible({ timeout: 5000 });
  return usersDialog;
}

async function leaveAssociation(page: Page) {
  await page.goto(PROFIL_URL);
  const card = associationCard(page);
  await expect(card).toBeVisible({ timeout: 10000 });
  const retirer = card.getByRole('button', { name: 'Retirer' });
  await retirer.scrollIntoViewIfNeeded();
  await retirer.click();
}

test('Un admin quitte l’association quand un autre admin reste', async ({ page }) => {
  const dialogs = acceptAndRecordDialogs(page);
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });

  await leaveAssociation(page);

  await expect(page.getByText(ASSOCIATION)).toHaveCount(0, { timeout: 10000 });
  expect(dialogs).toEqual(['Voulez-vous vraiment supprimer cette relation ?']);
});

test('Le dernier admin ne peut ni quitter l’association ni retirer ses droits tant qu’il reste des membres', async ({
  page,
}) => {
  const dialogs = acceptAndRecordDialogs(page);
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });

  // l'autre admin devient simple membre
  let usersDialog = await openUsersDialog(page);
  const otherAdminRow = usersDialog
    .locator('.bg-contrast-grey')
    .filter({ hasText: 'premier-detenteur@example.fr' })
    .filter({ hasNotText: 'examinateur-premier-detenteur@example.fr' });
  await otherAdminRow.locator('.select-relation-status__dropdown-indicator').click();
  await page.locator('.select-relation-status__menu').getByText('Membre', { exact: true }).click();
  await expect
    .poll(() => dialogs.at(-1), { timeout: 10000 })
    .toBe("Voulez-vous vraiment retirer les droits d'administrateur à cet utilisateur ?");

  // la liste est rechargée après la modification (la modale se ferme) : on la rouvre
  usersDialog = await openUsersDialog(page);
  await expect(otherAdminRow.getByText('Membre', { exact: true })).toBeVisible({ timeout: 10000 });

  // retirer ses propres droits d'admin est refusé
  const myRow = usersDialog
    .locator('.bg-contrast-grey')
    .filter({ hasText: 'examinateur-premier-detenteur@example.fr' });
  await myRow.locator('.select-relation-status__dropdown-indicator').click();
  await page.locator('.select-relation-status__menu').getByText('Membre', { exact: true }).click();
  await expect
    .poll(() => dialogs.at(-1), { timeout: 10000 })
    .toBe(
      'Vous êtes le seul administrateur de cette entité. Nommez un autre administrateur avant de retirer vos droits.'
    );

  // quitter l'association est refusé
  await leaveAssociation(page);
  await expect
    .poll(() => dialogs.at(-1), { timeout: 10000 })
    .toBe(
      'Vous êtes le seul administrateur de cette entité. Nommez un autre administrateur avant de la quitter.'
    );

  // l'association et les droits d'admin sont toujours là
  await page.goto(PROFIL_URL);
  await expect(associationCard(page).getByRole('button', { name: 'Voir les utilisateurs' })).toBeVisible({
    timeout: 10000,
  });
});

test('Le seul membre de l’association la supprime de Zacharie en la quittant', async ({ page }) => {
  const dialogs = acceptAndRecordDialogs(page);
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  await leaveAssociation(page);
  await expect(page.getByText(ASSOCIATION)).toHaveCount(0, { timeout: 10000 });

  await logoutAndConnect(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  await leaveAssociation(page);

  await expect(page.getByText(ASSOCIATION)).toHaveCount(0, { timeout: 10000 });
  expect(dialogs.at(-1)).toBe(
    'Vous êtes le seul membre de cette association, voulez-vous vraiment la supprimer de Zacharie ?'
  );
});
