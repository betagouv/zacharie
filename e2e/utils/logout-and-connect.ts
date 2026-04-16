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
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await page.goto("http://localhost:3290/app/connexion", { timeout: 10000 });
  await expect(page).toHaveURL(/\/app\/connexion/);
  await connectWith(page, email, password);
}
