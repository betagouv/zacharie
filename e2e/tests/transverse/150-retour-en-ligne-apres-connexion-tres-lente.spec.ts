import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 144 — Après un événement 'very-bad-connection' (timeout de GET /user/me), le navigateur
// ne renvoie pas d'événement 'online' car navigator.onLine est resté vrai. L'application retente
// /user/me toutes les 30 s (use-is-offline.ts) : le succès émet 'good-connection' et la remet en
// ligne toute seule, sans rechargement.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.setTimeout(120_000);

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test("L'application repasse en ligne d'elle-même après une connexion très lente", async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const offlineBanner = page.getByText("Vous n'avez pas internet, ou votre connexion est très mauvaise.");
  await expect(offlineBanner).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event('very-bad-connection')));
  await expect(offlineBanner).toBeVisible();

  // Premier essai de /user/me 30 s après l'événement.
  await expect(offlineBanner).toBeHidden({ timeout: 45_000 });
});
