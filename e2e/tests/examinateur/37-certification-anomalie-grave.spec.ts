import { test, expect, type Page } from '../../utils/test';
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

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// Crée une fiche avec une carcasse portant l'anomalie donnée, jusqu'au bloc de validation.
async function ficheAvecAnomalie(page: Page, anomalie: string) {
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
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  await page.getByRole('button', { name: 'Externe' }).click();
  await page.getByRole('button', { name: anomalie, exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page
    .getByRole('dialog', { name: 'Anomalies renseignées' })
    .getByRole('button', { name: 'Continuer' })
    .click();

  await page
    .getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' }).blur();

  await expect(page.getByRole('heading', { name: "Validation de l'examen initial" })).toBeVisible();
}

test("Anomalie grave — la certification n'affirme pas que les carcasses peuvent être mises sur le marché", async ({
  page,
}) => {
  await ficheAvecAnomalie(page, 'Abcès unique');

  await expect(
    page.getByText(/présentent au moins une anomalie, renseignée sur cette fiche\./).first()
  ).toBeVisible();
  await expect(page.getByText(/peuvent être mises sur le marché/)).toHaveCount(0);
});

test('Anomalie bénigne — la certification indique que les carcasses peuvent être mises sur le marché', async ({
  page,
}) => {
  await ficheAvecAnomalie(page, 'Tiques');

  await expect(
    page
      .getByText(/présentent au moins une anomalie\. Toutefois, elles peuvent être mises sur le marché\./)
      .first()
  ).toBeVisible();
});
