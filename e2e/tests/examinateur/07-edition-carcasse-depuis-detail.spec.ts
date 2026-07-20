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

test('Edition carcasse — ajout anomalie via le picker, persistée au rouvrir', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  // Crée une fiche minimale avec 1 carcasse (sans anomalie)
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  // Ouvrir la modale d'édition de la carcasse
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();

  // Ajouter une anomalie abats via le picker : site anatomique → anomalie
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  await page.getByRole('button', { name: 'Système respiratoire (trachée, poumons)' }).click();
  await page.getByRole('button', { name: 'Abcès', exact: true }).click();

  // Sortir du picker : Retour (liste anomalies → sites), Retour (sites → formulaire)
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();

  // Fermer la modale d'édition
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click();

  // Rouvrir : l'anomalie a persisté (le bouton du picker affiche le compteur)
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Anomalies (1)' })).toBeVisible({ timeout: 10000 });
});
