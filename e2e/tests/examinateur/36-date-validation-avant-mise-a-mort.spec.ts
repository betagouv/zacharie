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

test("Date de validation de l'examen antérieure à la date de mise à mort → fiche bloquée", async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  const heurePrelevement = page.getByRole('textbox', {
    name: 'Heure du prélèvement de la première carcasse',
  });
  await heurePrelevement.fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await heurePrelevement.blur();
  const heureEvisceration = page.getByRole('textbox', {
    name: 'Heure d’éviscération de la dernière carcasse',
  });
  await heureEvisceration.fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await heureEvisceration.blur();

  // mise à mort aujourd'hui, validation la veille
  const dateValidation = page.locator('#examinateur_initial_date_approbation_mise_sur_le_marche');
  await dateValidation.scrollIntoViewIfNeeded();
  await dateValidation.fill(dayjs().subtract(1, 'day').hour(10).minute(0).format('YYYY-MM-DDTHH:mm'));
  await dateValidation.blur();

  const messageErreur = page
    .getByText(
      'La date de validation de l’examen initial ne peut pas être antérieure à la date de mise à mort'
    )
    .first();
  await expect(messageErreur).toBeVisible();

  await page.getByText('Je, Martin Marie, certifie qu').click();
  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText('Champs manquants pour transmettre')).toBeVisible();
  await expect(page.getByText(/Votre fiche a été transmise/i)).toHaveCount(0);

  // une date de validation corrigée débloque la transmission
  await dateValidation.scrollIntoViewIfNeeded();
  await dateValidation.fill(dayjs().startOf('day').add(3, 'hour').format('YYYY-MM-DDTHH:mm'));
  await dateValidation.blur();
  await expect(messageErreur).toHaveCount(0);

  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
});
