import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 179 — Le paramètre `redirect` de /app/connexion et /app/proconnect
// (app-local-first-react-router/src/utils/sanitize-redirect.ts) :
// - une déconnexion volontaire n'impose pas la page quittée à l'utilisateur suivant ;
// - un `redirect` vers l'espace d'un autre rôle renvoie sur l'accueil du rôle connecté ;
// - un `redirect` imbriqué (redirect=...redirect=...) est aplati vers la page finale.

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb();
});

// Remplit le formulaire de /app/connexion sans recharger la page : on garde l'état de l'app
// laissé par la déconnexion, comme un vrai utilisateur
async function fillLoginForm(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Mon email Renseignez votre' }).fill(email);
  await page.getByRole('textbox', { name: 'Mon mot de passe Veuillez' }).fill('secret-secret');
  await page.getByRole('button', { name: 'Me connecter' }).click();
}

test.describe('chasseur', () => {
  test.use({ viewport: { width: 350, height: 667 }, hasTouch: true, isMobile: true });

  test("après une déconnexion depuis une page profonde, l'utilisateur suivant arrive sur son accueil", async ({
    page,
  }) => {
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
    await page.goto('http://localhost:3290/app/chasseur/profil/coordonnees');
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur/profil/coordonnees');

    const menuBtn = page.getByRole('button', { name: 'Menu' });
    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.click();
    }
    await page.getByRole('button', { name: 'Déconnexion' }).click();
    // déconnexion volontaire : pas de `redirect` vers la page quittée
    await expect(page).toHaveURL('http://localhost:3290/app/connexion', { timeout: 15000 });

    await fillLoginForm(page, 'premier-detenteur@example.fr');
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 10000 });
  });

  test("un lien profond de son espace est ouvert après la connexion, même s'il est imbriqué", async ({
    page,
  }) => {
    await page.goto('http://localhost:3290/app/chasseur/profil/coordonnees');
    await expect(page).toHaveURL(
      'http://localhost:3290/app/connexion?redirect=%2Fapp%2Fchasseur%2Fprofil%2Fcoordonnees'
    );

    const nested = `/app/connexion?redirect=${encodeURIComponent('/app/chasseur/profil/coordonnees')}`;
    await page.goto(`http://localhost:3290/app/connexion?redirect=${encodeURIComponent(nested)}`);
    await fillLoginForm(page, 'examinateur@example.fr');
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur/profil/coordonnees', { timeout: 10000 });
  });
});

test("un lien vers l'espace d'un autre rôle renvoie sur l'accueil du rôle connecté", async ({ page }) => {
  await page.goto('http://localhost:3290/app/connexion?redirect=%2Fapp%2Fchasseur%2Fprofil%2Fcoordonnees');
  await fillLoginForm(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg', { timeout: 10000 });
});

test('un redirect imbriqué vers ProConnect est aplati vers la page admin demandée', async ({ page }) => {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);

  const nested = `/app/proconnect?redirect=${encodeURIComponent('/app/admin/users')}`;
  await page.goto(`http://localhost:3290/app/proconnect?redirect=${encodeURIComponent(nested)}`);
  const proConnectLink = page.locator('a[href*="/user/proconnect/start"]');
  await expect(proConnectLink).toHaveAttribute('href', /redirect=%2Fapp%2Fadmin%2Fusers(&|$)/);

  await proConnectLink.click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL('http://localhost:3290/app/admin/users', { timeout: 10000 });
});
