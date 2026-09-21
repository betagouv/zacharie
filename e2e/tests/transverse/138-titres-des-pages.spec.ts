import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scénario 138 — Chaque page pose un <title>.
// Sans <title>, le navigateur affiche l'URL brute dans l'onglet, l'historique et les favoris,
// et Matomo enregistre une page vue sans nom (MatomoTracker envoie document.title).
// Le garde-fou statique vit dans app-local-first-react-router/src/routes/routes-have-a-title.test.ts ;
// ici on vérifie le rendu réel dans le navigateur.

const BASE = 'http://localhost:3290';

test.describe('Titres des pages publiques', () => {
  const publicPages: Array<[string, RegExp]> = [
    ['/', /^Zacharie \| Garantir des viandes de gibier sauvage saines et sûres \|/],
    ['/pros', /^Zacharie pour les professionnels de la filière de valorisation du gibier sauvage \|/],
    ['/demarches', /^Toutes vos démarches avec Zacharie \|/],
    ['/mentions-legales', /^Mentions Légales \| Zacharie \|/],
    ['/accessibilite', /^Déclaration d'accessibilité \| Zacharie \|/],
    ['/politique-de-confidentialite', /^Politique de confidentialité \| Zacharie \|/],
    ['/modalites-d-utilisation', /^Modalités d’utilisation \| Zacharie \|/],
    ['/stats', /^Statistiques \| Zacharie \|/],
    ['/stats/matrice-impact', /^Matrice d'impact \| Zacharie \|/],
    ['/contact', /^Contact \| Zacharie \|/],
    ['/faq', /^Mode d'emploi et questions fréquentes \| Zacharie \|/],
    ['/quiz', /^Testez vos connaissances sur la valorisation du gibier \| Zacharie/],
    ['/app/connexion', /^Connexion \| Zacharie \|/],
    ['/app/connexion/mot-de-passe-oublie', /^Mot de passe oublié \| Zacharie \|/],
  ];

  for (const [pathname, expectedTitle] of publicPages) {
    test(`${pathname} a un titre`, async ({ page }) => {
      await page.goto(`${BASE}${pathname}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(expectedTitle, { timeout: 10000 });
    });
  }

  test('une URL inconnue a le titre de la page 404', async ({ page }) => {
    await page.goto(`${BASE}/cette-page-n-existe-pas`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/^Page non trouvée \| Zacharie \|/, { timeout: 10000 });
  });
});

test.describe('Titres des pages chasseur', () => {
  test.use({ viewport: { width: 350, height: 667 }, isMobile: true, hasTouch: true });

  test('les pages chasseur ont un titre', async ({ page }) => {
    await resetDb('PREMIER_DETENTEUR');
    await connectWith(page, 'examinateur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/);

    const chasseurPages: Array<[string, RegExp]> = [
      ['/app/chasseur', /^Mes fiches \| Zacharie \|/],
      ['/app/chasseur/tableau-de-bord', /^Tableau de bord \| Zacharie \|/],
      ['/app/chasseur/fei/ZACH-20250707-QZ6E0-155242', /^ZACH-20250707-QZ6E0-155242 \| Zacharie \|/],
      ['/app/chasseur/profil/coordonnees', /^Coordonnées \| Zacharie \|/],
      ['/app/chasseur/profil/ccgs', /^Mes chambres froides \(CCGs\) \| Zacharie \|/],
      ['/app/chasseur/profil/notifications', /^Mes notifications \| Zacharie \|/],
      ['/app/chasseur/contact', /^Contact \| Zacharie \|/],
    ];

    for (const [pathname, expectedTitle] of chasseurPages) {
      await page.goto(`${BASE}${pathname}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(expectedTitle, { timeout: 10000 });
    }
  });
});

test.describe('Titres des pages SVI', () => {
  test('les pages SVI ont un titre', async ({ page }) => {
    await resetDb('SVI');
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    const sviPages: Array<[string, RegExp]> = [
      ['/app/svi', /^Mes fiches \| Zacharie \|/],
      ['/app/svi/tableau-de-bord', /^Tableau de bord \| Zacharie \|/],
      ['/app/svi/carcasses', /^Registre de carcasses \| Zacharie \|/],
      ['/app/svi/profil/coordonnees', /^Coordonnées \| Zacharie \|/],
      ['/app/svi/entreprise/informations', /^Mon service \| Zacharie \|/],
    ];

    for (const [pathname, expectedTitle] of sviPages) {
      await page.goto(`${BASE}${pathname}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(expectedTitle, { timeout: 10000 });
    }
  });
});
