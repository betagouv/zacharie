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
  await page.getByRole('textbox', { name: 'Mon email Renseignez votre' }).fill(email);
  await page.getByRole('textbox', { name: 'Mon mot de passe Veuillez' }).fill(password);
  const loginResponse = page.waitForResponse(
    (res) => res.url().includes('/user/login') && res.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await loginResponse;
  await page.waitForURL((url) => !url.pathname.endsWith('/app/connexion'), { timeout: 10000 });
}
