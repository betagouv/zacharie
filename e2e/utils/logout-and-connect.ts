import { type Page } from '@playwright/test';
import { connectWith } from './connect-with';

export async function logoutAndConnect(page: Page, email: string, password: string = 'secret-secret') {
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuBtn.click();
  }
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });
  await connectWith(page, email, password);
}
