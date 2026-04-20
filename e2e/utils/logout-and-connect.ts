import { expect, type Page } from "@playwright/test";
import { connectWith } from "./connect-with";

/**
 * Logs the current user out and connects a different user.
 *
 * Uses `page.goto('/app/connexion')` (not nav clicks) to force a hard reset
 * of the local-first store before the new login — otherwise the Zustand
 * store can still hold the previous user's fiches/carcasses and leak into
 * assertions.
 *
 * Pattern established in `fiche_dispatch_multi_destinataires.spec.ts`.
 */
export async function logoutAndConnect(page: Page, email: string, password: string = "secret-secret") {
  // In mobile viewport, the DSFR header hides quick-access items behind a "Menu" button.
  // In desktop viewport, "Déconnexion" is directly visible — no hamburger menu.
  const menuBtn = page.getByRole("button", { name: "Menu" });
  if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuBtn.click();
  }
  // Click Déconnexion and wait for the app to navigate away (clearCache + redirect)
  await page.getByRole("button", { name: "Déconnexion" }).click();
  // Wait for the logout to complete - the app navigates to /app/connexion after clearCache
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 }).catch(() => {});
  // Force navigate to /app/connexion in case the auto-redirect didn't fire
  await page.goto("http://localhost:3290/app/connexion", { timeout: 10000 });
  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 10000 });
  await connectWith(page, email, password);
}
