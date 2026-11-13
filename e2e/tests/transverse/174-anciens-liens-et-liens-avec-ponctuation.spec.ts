import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scénario 174 — URLs qui finissaient sur la page 404 (Sentry « PageNotFound 404 ») :
// - les anciens liens `/app/tableau-de-bord/...` (profil, fiche envoyée) redirigent vers le
//   tableau de bord du rôle ;
// - un lien ouvert avec la ponctuation qui le suit (`/)`) est corrigé vers la bonne page.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('un ancien lien /app/tableau-de-bord/mon-profil/mes-roles mène au tableau de bord chasseur', async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/tableau-de-bord/mon-profil/mes-roles');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  await expect(page.getByText("Mince, Zach'a ri-en trouvé")).not.toBeVisible();
});

test('un lien suivi d’une parenthèse (/)) mène à la page d’accueil', async ({ page }) => {
  await page.goto('http://localhost:3290/)');
  await expect(page).toHaveURL('http://localhost:3290/', { timeout: 10000 });
  await expect(page.getByText("Mince, Zach'a ri-en trouvé")).not.toBeVisible();
});
