import { type Page } from '@playwright/test';
import { connectWith } from './connect-with';

export async function logoutAndConnect(page: Page, email: string, password: string = 'secret-secret') {
  // In mobile viewport, the DSFR header hides quick-access items behind a "Menu" button.
  // In desktop viewport, "Déconnexion" is directly visible — no hamburger menu.
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuBtn.click();
  }
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  // Let the in-app redirect fire on its own — no page.goto fallback, so any
  // regression of the logout/redirect path fails loudly here.
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });
  await connectWith(page, email, password);
}
