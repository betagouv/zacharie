import { test, expect } from '../../utils/test';
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

// Régression — fix chasseur vision destinataire.
// Quand le premier détenteur d'une fiche est une Association de chasseurs (entité),
// TOUT membre de cette association (relation CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
// doit voir le bloc « Destinataire » — pas uniquement l'utilisateur dont l'id est
// stocké dans `premier_detenteur_user_id`. Avant le fix, `isPremierDetenteur` se
// basait uniquement sur `fei.premier_detenteur_user_id === user.id` et masquait
// le bloc pour les autres membres de l'association.
//
// La fiche porte DEUX carcasses et User A n'en transmet qu'UNE : il reste donc une
// carcasse à attribuer. C'est indispensable car le bloc « Destinataire » est désormais
// masqué quand toutes les carcasses ont été assignées (`!allCarcassesAssigned`). Avec
// une carcasse restante, le bloc reste visible et la régression `isPremierDetenteur`
// est bien couverte.
test("Autre membre de l'Association voit le bloc Destinataire sur la fiche", async ({ page }) => {
  // --- User A : examinateur-premier-detenteur (membre Association de chasseurs)
  //     crée et transmet la fiche au nom de l'Association.
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // Premier détenteur = Association (entité, pas un utilisateur).
  // → `premier_detenteur_user_id = User A.id` ET `premier_detenteur_entity_id = Association.id`.
  await page.getByRole('button', { name: /Association de chasseurs/i }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Bloc 2 — deux carcasses (Daim + Cerf), pour pouvoir n'en transmettre qu'une.
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Ajouter une autre carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Cerf élaphe');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page
    .getByRole('textbox', { name: 'Début de la chasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Début de la chasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Fin de l’examen initial' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Fin de l’examen initial' }).blur();

  // Validation de l'examen initial.
  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  // Capture du numéro de fiche AVANT la navigation post-transmission.
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  // Premier Transmettre — déclenche la transition inline vers le dispatch PD.
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  // Sélection ETG 1 puis dispatch.
  const etg1Pill = page.getByRole('button', { name: /ETG 1/i });
  await expect(etg1Pill).toBeVisible({ timeout: 15000 });
  await etg1Pill.scrollIntoViewIfNeeded();
  await etg1Pill.click();

  // On ne transmet que le Daim : on retire le Cerf du groupe de destinataire.
  // Il reste ainsi une carcasse non attribuée pour que le bloc « Destinataire »
  // demeure visible côté User B.
  const destinataireSection = page
    .locator('div.bg-white')
    .filter({ has: page.getByRole('heading', { name: 'Destinataire' }) });
  const cerfToggle = destinataireSection.getByRole('button', { name: /Cerf/ });
  await cerfToggle.scrollIntoViewIfNeeded();
  await cerfToggle.click();

  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  // Beacon de sync — la fiche est bien remontée jusqu'au backend.
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });

  // --- User B : premier-detenteur (autre utilisateur, AUSSI membre de l'Association
  //     via CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY).
  //     `premier_detenteur_user_id` est celui de User A, mais User B doit pouvoir
  //     agir comme premier détenteur via l'entité.
  await logoutAndConnect(page, 'premier-detenteur@example.fr');

  // Accès direct à la fiche (User B n'est pas dans `premier_detenteur_user_id`
  // mais l'API /fei/:numero ne filtre pas par ownership ; loadMyRelations
  // s'assure que l'entité Association est en store avec la bonne relation).
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);

  // Cœur du test : sans le fix, `isPremierDetenteur` aurait été `false` et le
  // bloc Destinataire aurait été masqué. Avec le fix, il est visible.
  // (Le titre « Destinataire » n'est rendu QUE par
  // `{showBloc3 && isPremierDetenteur && !allCarcassesAssigned}` dans chasseur-fei.tsx —
  // aucun autre composant ne l'émet, donc l'assertion est suffisante. Le Cerf restant
  // garantit `!allCarcassesAssigned`.)
  await expect(page.getByRole('heading', { name: 'Destinataire' })).toBeVisible({ timeout: 15000 });
});
