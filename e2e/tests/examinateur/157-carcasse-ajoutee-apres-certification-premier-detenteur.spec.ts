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

// Le premier détenteur est choisi sur la fiche avant les carcasses. Une carcasse ajoutée après la
// certification de l'examen initial doit le porter aussi : la carte de la fiche lit le nom du
// premier détenteur sur ses carcasses.
test('Une carcasse ajoutée après la certification porte le premier détenteur de la fiche', async ({
  page,
}) => {
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  await page.getByRole('button', { name: /Association de chasseurs/i }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  await page
    .getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' }).blur();

  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  // Carcasse ajoutée après la certification : la certification ne la rattrape plus.
  const ajouterCarcasse = page.getByRole('button', { name: 'Ajouter une carcasse' });
  await ajouterCarcasse.scrollIntoViewIfNeeded();
  await ajouterCarcasse.click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  const suggestionBracelet = page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ });
  const numeroBraceletTardif = (await suggestionBracelet.textContent())!.trim();
  await suggestionBracelet.click();

  // Le serveur reçoit la carcasse tardive avec le premier détenteur de la fiche.
  const syncCarcasseTardive = page.waitForResponse(
    (res) =>
      res.url().includes('/sync') &&
      res.request().method() === 'POST' &&
      res.ok() &&
      (res.request().postData() ?? '').includes(numeroBraceletTardif) &&
      (res.request().postData() ?? '').includes('"premier_detenteur_name_cache":"Association de chasseurs"'),
    { timeout: 15000 }
  );
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await syncCarcasseTardive;

  // On retire la première carcasse : la fiche ne garde que la carcasse tardive, la carte ne peut
  // donc lire le premier détenteur que sur elle.
  await expect(page.getByRole('button', { name: /Daim N°/ })).toHaveCount(2, { timeout: 5000 });
  const premiereCarcasse = page
    .getByRole('button', { name: /Daim N°/ })
    .filter({ hasNotText: numeroBraceletTardif });
  await premiereCarcasse.scrollIntoViewIfNeeded();
  await premiereCarcasse.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer la carcasse' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByRole('button', { name: /Daim N°/ })).toHaveCount(1, { timeout: 5000 });

  await page.goto('http://localhost:3290/app/chasseur');
  const carteFiche = page.getByRole('link', { name: feiNumero! }).first();
  await expect(carteFiche).toBeVisible({ timeout: 15000 });
  await expect(carteFiche).toContainText('Association de chasseurs');
});
