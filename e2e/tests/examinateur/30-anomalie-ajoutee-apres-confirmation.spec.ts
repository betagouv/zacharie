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

// La confirmation « Continuer » ne vaut que pour l'état des carcasses au moment du clic.
// Ajouter une carcasse ensuite doit replier les blocs suivants : sinon on transmet la fiche
// sans jamais voir le message d'avertissement de l'anomalie ajoutée.
test('Anomalie ajoutée après confirmation — la fiche se replie et le message est revu', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Carcasse 1 sans anomalie, puis confirmation.
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText("Vous n'avez pas renseigné d'anomalie")).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  // Les heures : c'est ce qui, avant le fix, gardait les blocs suivants ouverts pour toujours.
  await page
    .getByRole('textbox', { name: 'Début de la chasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Début de la chasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Fin de l’examen initial' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Fin de l’examen initial' }).blur();

  // Le destinataire est un autre utilisateur (Pierre Petit) : ici le bloc suivant est la validation.
  await expect(page.getByRole('heading', { name: "Validation de l'examen initial" })).toBeVisible();

  // Carcasse 2 AVEC une anomalie porteuse d'un message.
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  await page.getByRole('button', { name: 'Externe' }).click();
  await page.getByRole('button', { name: 'Abcès unique', exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();

  // La confirmation est invalidée : bloc de validation replié, transmission bloquée.
  await expect(page.getByRole('heading', { name: "Validation de l'examen initial" })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Début de la chasse' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Transmettre', exact: true })).toBeDisabled();

  // Re-confirmer fait passer par le message d'avertissement de l'anomalie.
  await page.getByRole('button', { name: 'Continuer' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Anomalies renseignées' });
  await expect(confirmDialog.getByText('Abcès unique')).toBeVisible();
  await expect(confirmDialog.getByText(/Ne pas commercialiser ou traitement de la carcasse/)).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Continuer' }).click();

  // Les heures saisies plus tôt sont conservées, la transmission redevient possible.
  await expect(page.getByRole('textbox', { name: 'Début de la chasse' })).toHaveValue(
    dayjs().startOf('day').add(1, 'hour').format('HH:mm')
  );
  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
});
