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

// Couvre la branche `nextIsMe` de examinateur-select-next.tsx :
// bouton « Je suis le Premier Détenteur » qui ne s'affiche QUE lorsque
// `isFirstFei && associationsDeChasse vide && detenteursInitiaux vide`.
// L'utilisateur examinateur-solo est seedé sans aucune relation pour
// déclencher cette branche.
// Garde-fou pour le bug `canEditAsPremierDetenteur` : le bloc Destinataire
// doit être éditable inline juste après le clic (pas après dispatch).
test('Examinateur seul (sans relations) — « Je suis le Premier Détenteur » et dispatch inline vers ETG 1', async ({
  page,
}) => {
  await connectWith(page, 'examinateur-solo@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // Branche `nextIsMe` — un seul clic règle `premier_detenteur_user_id = user.id`
  // et bascule `isPremierDetenteur = true` côté chasseur-fei.tsx, ce qui doit
  // déclencher l'affichage progressif du bloc Destinataire plus loin.
  await page.getByRole('button', { name: 'Je suis le Premier Détenteur' }).click();

  // Bloc 2 — une carcasse.
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: 'Utiliser' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page
    .getByRole('textbox', { name: 'Heure de mise à mort de la' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure de mise à mort de la' }).blur();
  await page
    .getByRole('textbox', { name: "Heure d'éviscération de la" })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: "Heure d'éviscération de la" }).blur();

  // Validation de l'examen initial.
  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  // Premier Transmettre — transition inline vers la vue dispatch PD (pas de
  // navigation, pas d'étape « Prendre en charge » : le current_owner est déjà PD
  // côté carcasses, et le bloc Destinataire est éditable grâce à
  // canEditAsPremierDetenteur (régression à éviter).
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  const etg1Pill = page.getByRole('button', { name: /ETG 1/i });
  await expect(etg1Pill).toBeVisible({ timeout: 15000 });
  await etg1Pill.scrollIntoViewIfNeeded();
  await etg1Pill.click();

  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  // Beacon de sync : la fiche est bien remontée et notifiée à ETG 1.
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});
