import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const question = /Utilisez-vous une ou plusieurs chambres froides/;
const ouiAvecNumero = /Oui et la chambre froide a un numéro d.identification/;
const ouiSansNumero = /Oui mais la chambre froide n.a pas de numéro d.identification/;
const nonPasDeCCG = /Non, pas d.utilisation de chambre froide/;

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// on clique le label DSFR : il recouvre l'input radio, qui n'est pas cliquable directement
async function cocher(page: Page, label: RegExp) {
  const option = page.getByText(label);
  await option.scrollIntoViewIfNeeded();
  await option.click();
}

test('CCG : aucune option cochée tant que le chasseur n’a pas répondu, "Non" persiste', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  await expect(page.getByText(question)).toBeVisible({ timeout: 10000 });

  // pas de réponse enregistrée et aucune CCG : aucune option n'est cochée
  await expect(page.getByRole('radio', { name: ouiAvecNumero })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: ouiSansNumero })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: nonPasDeCCG })).not.toBeChecked();

  const reponseEnregistree = page.waitForResponse(
    (res) => res.url().includes('/user/') && res.request().method() === 'POST' && res.ok()
  );
  await cocher(page, nonPasDeCCG);
  await reponseEnregistree;
  await expect(page.getByRole('radio', { name: nonPasDeCCG })).toBeChecked();

  // réponse enregistrée et toujours aucune CCG : "Non" reste coché
  await page.reload();
  await expect(page.getByText(question)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('radio', { name: nonPasDeCCG })).toBeChecked();
  await expect(page.getByRole('radio', { name: ouiAvecNumero })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: ouiSansNumero })).not.toBeChecked();
});

test('CCG : la question disparaît une fois une chambre froide enregistrée', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  await expect(page.getByText(question)).toBeVisible({ timeout: 10000 });

  await cocher(page, ouiAvecNumero);
  await expect(page.getByRole('radio', { name: ouiAvecNumero })).toBeChecked();

  await page.getByRole('textbox', { name: /Numéro d'identification/ }).fill('CCG-01');
  await page.getByRole('button', { name: 'Ajouter cette chambre froide' }).click();
  await expect(page.getByText(/CCG Chasseurs|CCG-01/).first()).toBeVisible({ timeout: 10000 });

  // une CCG est enregistrée : la question n'est plus posée
  await expect(page.getByText(question)).toBeHidden();
  await page.reload();
  await expect(page.getByText(/CCG Chasseurs|CCG-01/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(question)).toBeHidden();
});
