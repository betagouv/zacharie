import { test, expect } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// Couvre la branche `else` de `handleSubmitFromSelect` empruntée via la
// recherche email (bouton « Chercher un Premier Détenteur par email » →
// POST /user/fei/trouver-premier-detenteur).
// Garde-fous combinés :
//  - le bouton et le formulaire email ne s'affichent que si l'utilisateur n'a
//    aucune association ni détenteur initial (examinateur-solo est seedé ainsi) ;
//  - après la recherche, le PD externe est ajouté en `detenteursInitiaux` et le
//    formulaire bascule sur la vue dropdown ;
//  - côté PD externe : le bloc Destinataire doit être éditable (régression
//    `canEditAsPremierDetenteur`). On vérifie en cliquant un pill ETG et en
//    contrôlant que l'étape suivante du formulaire apparaît.
test('Recherche par email d’un PD externe — handoff complet + dispatch éditable côté PD', async ({
  page,
}) => {
  await connectWith(page, 'examinateur-solo@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // Bouton standalone affiché car associationsDeChasse et detenteursInitiaux sont vides.
  await page.getByRole('button', { name: 'Chercher un Premier Détenteur par email' }).click();
  await page.getByLabel("Saisissez l'email du Premier Détenteur").fill('premier-detenteur@example.fr');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();

  // La recherche réussit → setShowSearchUserByEmail(false) + setNextOwnerUserOrEntityId
  // → le formulaire email disparaît et la dropdown remplace les 3 boutons
  // (detenteursInitiaux n'est plus vide). On valide la sélection avec Continuer.
  await expect(page.locator('#select-next-owner')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Capture du numéro de fiche AVANT la navigation post-transmission.
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

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

  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  // Transmission vers PD externe → branche `else` de handleTransmettre, qui écrit
  // current_owner = PD et purge next_owner_*. Navigation vers /envoyée.
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre fiche a été transmise' })).toBeVisible({
    timeout: 15000,
  });

  // --- Côté PD externe : la fiche doit apparaître côté PD et le bloc Destinataire
  //     doit être éditable. Sans la purge de next_owner_*, get-fei-sorted.ts
  //     classerait la fiche dans `feisToTake` au lieu de `feisUnderMyResponsability`
  //     (les deux remontent dans `feisAssigned` côté chasseur, donc on s'appuie
  //     sur la visibilité du lien). Sans le fix `canEditAsPremierDetenteur`, le
  //     pill ETG 1 ne serait pas interactif.
  await logoutAndConnect(page, 'premier-detenteur@example.fr');

  const fichePill = page.getByRole('link', { name: feiNumero! });
  await expect(fichePill).toBeVisible({ timeout: 15000 });
  await fichePill.click();

  await expect(page.getByRole('heading', { name: 'Destinataire' })).toBeVisible({ timeout: 15000 });

  // Vérification d'interactivité : on clique sur le pill ETG 1 et on attend
  // l'étape suivante du formulaire de dispatch (« Pas de stockage »).
  // Si canEditAsPremierDetenteur était à false, le pill ne déclencherait pas
  // la transition d'étape (champs en lecture seule).
  const etg1Pill = page.getByRole('button', { name: /ETG 1/i });
  await expect(etg1Pill).toBeVisible({ timeout: 15000 });
  await etg1Pill.scrollIntoViewIfNeeded();
  await etg1Pill.click();
  await expect(page.getByText('Pas de stockage').first()).toBeVisible({ timeout: 10000 });
});
