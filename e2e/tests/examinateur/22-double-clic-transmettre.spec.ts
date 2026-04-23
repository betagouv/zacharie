import { test, expect } from '@playwright/test';
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

test('Double-clic Transmettre — pas de double soumission', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: 'Utiliser' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByRole('textbox', { name: 'Heure de mise à mort de la' }).fill('01:00');
  await page.getByRole('textbox', { name: 'Heure de mise à mort de la' }).blur();
  await page.getByRole('textbox', { name: "Heure d'éviscération de la" }).fill('02:00');
  await page.getByRole('textbox', { name: "Heure d'éviscération de la" }).blur();

  await page.getByRole('button', { name: 'Définir comme étant la date du jour et maintenant' }).click();
  await page.getByText('Je, Martin Marie, certifie qu').click();

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  // Double-click rapidly — should not create 2 fiches
  await transmettre.dblclick();

  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // Vérifier qu'une seule fiche a été créée
  await page.getByRole('link', { name: 'Voir toutes les fiches' }).click();
  const fiches = await page.getByRole('link', { name: /ZACH-\d+-\w+-\d+/ }).count();
  expect(fiches).toBe(1);
});
