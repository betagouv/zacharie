import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Retirer une carcasse déjà ajoutée — compteur MAJ + transmission OK', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Ajouter 2 carcasses
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
    await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
    await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
    await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  }

  // Supprimer la 1ère via la modale d'édition (plus de corbeille ni window.confirm).
  await expect(page.getByRole('button', { name: /Daim N°/ })).toHaveCount(2, { timeout: 5000 });
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer la carcasse' })
    .getByRole('button', { name: 'Supprimer' })
    .click();

  // Il reste 1 carcasse
  await expect(page.getByRole('button', { name: /Daim N°/ })).toHaveCount(1, { timeout: 5000 });
});
