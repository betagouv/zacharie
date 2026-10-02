import { type Page } from '@playwright/test';
import { connectWith } from './connect-with';

export async function logoutAndConnect(page: Page, email: string, password: string = 'secret-secret') {
  // In mobile viewport, the DSFR header hides quick-access items behind a "Menu" button.
  // In desktop viewport, "Déconnexion" is directly visible — no hamburger menu.
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  // isVisible() n'attend pas : on attend d'abord que l'en-tête soit rendu (l'app n'affiche rien tant
  // que l'onglet n'a pas obtenu le verrou d'onglet actif et réhydraté le store).
  await menuBtn
    .or(page.getByRole('button', { name: 'Déconnexion' }))
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 15000 });
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
  }
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  // Let the in-app redirect fire on its own — no page.goto fallback, so any
  // regression of the logout/redirect path fails loudly here.
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });
  await connectWith(page, email, password);
}
