import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 129 — Le bouton Déconnexion redirige vers /app/connexion ET vide le store useUser.
// Garde-fou contre la régression où pushState changeait l'URL sans rerender de BrowserRouter,
// ou où useUser restait peuplé et /app/connexion rebondissait vers /app/[role] (mode offline).

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test('Déconnexion redirige vers /app/connexion et vide useUser', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  // En mobile, "Déconnexion" est derrière le bouton "Menu" du header DSFR.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();

  // 1. La redirection automatique se produit — sans page.goto de secours.
  //    C'est le coeur du fix : pushState + dispatchEvent('popstate') doit faire
  //    rerender BrowserRouter, sinon l'URL changerait mais la route resterait.
  await page.waitForURL(/\/app\/connexion/, { timeout: 10000 });

  // 2. L'URL tient dans la durée — pas de rebond vers /app/chasseur.
  //    why waitForTimeout : on garde contre une régression où l'URL flippe puis
  //    un rerender la renvoie sur /app/[role]. Le temps écoulé EST l'outcome.
  await page.waitForTimeout(5000);
  await expect(page).toHaveURL(/\/app\/connexion/);

  // 3. La route Connexion s'est réellement rendue (pas seulement l'URL qui a changé).
  await expect(page.getByRole('textbox', { name: 'Mon email Renseignez votre' })).toBeVisible();

  // 4. Le store zustand useUser est vidé dans localStorage.
  const stored = await page.evaluate(() => localStorage.getItem('zacharie-zustand-user-store'));
  expect(stored).toBeNull();
});
