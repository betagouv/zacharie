import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const ANCIEN_MOT_DE_PASSE = 'secret-secret';
const NOUVEAU_MOT_DE_PASSE = 'nouveau-mot-de-passe';

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('135 - Changer mon mot de passe : erreurs, succès, et reconnexion avec le nouveau', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  // accès depuis le menu Paramètres, sous "Coordonnées"
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('link', { name: 'Changer de mot de passe' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/profil\/mot-de-passe/);
  await expect(page.getByRole('heading', { name: 'Changer de mot de passe' })).toBeVisible();

  const motDePasseActuel = page.getByRole('textbox', { name: /Mot de passe actuel/i });
  const nouveauMotDePasse = page.getByRole('textbox', { name: /^Nouveau mot de passe/i });
  const confirmation = page.getByRole('textbox', { name: /^Confirmer le nouveau mot de passe/i });
  const submit = page.getByRole('button', { name: 'Changer mon mot de passe' });

  // 1. les deux nouveaux mots de passe ne correspondent pas : erreur côté client, pas d'appel API
  await motDePasseActuel.scrollIntoViewIfNeeded();
  await motDePasseActuel.fill(ANCIEN_MOT_DE_PASSE);
  await nouveauMotDePasse.fill(NOUVEAU_MOT_DE_PASSE);
  await confirmation.fill(`${NOUVEAU_MOT_DE_PASSE}-different`);
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(page.getByText('Les deux mots de passe ne sont pas identiques')).toBeVisible();

  // 2. mauvais mot de passe actuel : erreur renvoyée par l'API
  await motDePasseActuel.scrollIntoViewIfNeeded();
  await motDePasseActuel.fill('mauvais-mot-de-passe');
  await confirmation.fill(NOUVEAU_MOT_DE_PASSE);
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(page.getByText('Mot de passe actuel incorrect')).toBeVisible({ timeout: 10000 });

  // 3. changement valide
  await motDePasseActuel.scrollIntoViewIfNeeded();
  await motDePasseActuel.fill(ANCIEN_MOT_DE_PASSE);
  await nouveauMotDePasse.fill(NOUVEAU_MOT_DE_PASSE);
  await confirmation.fill(NOUVEAU_MOT_DE_PASSE);
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(page.getByText('Votre mot de passe a été modifié')).toBeVisible({ timeout: 10000 });

  // le formulaire est vidé après succès
  await expect(motDePasseActuel).toHaveValue('');
  await expect(nouveauMotDePasse).toHaveValue('');
  await expect(confirmation).toHaveValue('');

  // 4. l'ancien mot de passe ne fonctionne plus
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });

  await connectWith(page, 'examinateur@example.fr', ANCIEN_MOT_DE_PASSE, false);
  await expect(page).toHaveURL(/\/app\/connexion/);
  await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible({ timeout: 10000 });

  // 5. le nouveau mot de passe fonctionne
  await connectWith(page, 'examinateur@example.fr', NOUVEAU_MOT_DE_PASSE);
  await expect(page).toHaveURL(/\/app\/chasseur/);
});
