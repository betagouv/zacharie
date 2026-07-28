import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { dateApprobationDuJour } from '../../utils/date-approbation';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Fiche avec anomalies abats & carcasse — persistées puis transmises', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  // Step 1: Create fiche with 1 daim
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Step 2: Ajouter la carcasse AVEC anomalies (1 abats + 1 carcasse) via le picker, pendant la création
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();

  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  // Anomalie abats : site → anomalie
  await page.getByRole('button', { name: 'Système respiratoire (trachée, poumons)' }).click();
  await page.getByRole('button', { name: 'Abcès', exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  // Second abats, homonyme du premier : « Abcès » existe sur deux systèmes, avec des
  // messages d'avertissement différents. C'est le cas qui distingue les alertes par famille.
  await page.getByRole('button', { name: 'Système digestif (foie, intestins)' }).click();
  await page.getByRole('button', { name: 'Abcès', exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  // Anomalie carcasse : site → anomalie
  await page.getByRole('button', { name: 'Externe' }).click();
  await page.getByRole('button', { name: 'Abcès unique', exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  // Sortir du picker → formulaire
  await page.getByRole('button', { name: 'Retour' }).click();

  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();

  // Step 3: Rouvrir la carcasse — les 3 anomalies ont persisté
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Anomalies (3)' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click();

  // Step 4: Continuer → modale de confirmation (anomalies renseignées) → Continuer
  await page.getByRole('button', { name: 'Continuer' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Anomalies renseignées' });
  await expect(page.getByText('Vous avez renseigné 3 anomalies')).toBeVisible();
  // Les deux « Abcès » sont distingués par leur famille, chacun avec son propre message.
  await expect(confirmDialog.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await expect(confirmDialog.getByText('Abcès - Système digestif (foie, intestins)')).toBeVisible();
  await expect(confirmDialog.getByText('Abcès unique - Externe')).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Continuer' }).click();

  // Step 5: Heures + transmission
  await page
    .getByRole('textbox', { name: 'Début de la chasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Début de la chasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Fin de l’examen initial' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Fin de l’examen initial' }).blur();

  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page.getByText('Je, Martin Marie, certifie qu').click();
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
});
