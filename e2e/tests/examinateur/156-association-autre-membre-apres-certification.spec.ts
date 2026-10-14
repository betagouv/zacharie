import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { dateApprobationDuJour } from '../../utils/date-approbation';
import {
  openVenteDon,
  allerAEtape,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
  selectDestinataire,
} from '../../utils/vente-don';
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

// Quand l'examinateur désigne son association comme premier détenteur, la fiche passe à
// l'association dès la certification de l'examen initial : un autre membre la voit dans son
// espace et peut faire la vente / le don à la place de l'examinateur. Celui qui transmet devient
// le détenteur courant.
test("Un autre membre de l'association transmet la fiche certifiée par l'examinateur", async ({ page }) => {
  // --- User A : examinateur-premier-detenteur, membre de « Association de chasseurs ».
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

  // La certification fait passer les carcasses au premier détenteur : on attend que ce passage
  // soit arrivé au serveur avant de se déconnecter, sinon la déconnexion l'efface.
  const syncPassageAssociation = page.waitForResponse(
    (res) =>
      res.url().includes('/sync') &&
      res.request().method() === 'POST' &&
      res.ok() &&
      (res.request().postData() ?? '').includes(feiNumero!) &&
      (res.request().postData() ?? '').includes('"current_owner_role":"PREMIER_DETENTEUR"'),
    { timeout: 15000 }
  );
  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();
  await syncPassageAssociation;

  // User A ne transmet pas : la vente / le don reste à faire.

  // --- User B : premier-detenteur (Pierre Petit), autre membre de « Association de chasseurs ».
  await logoutAndConnect(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  // Avant la certification, la fiche restait invisible pour User B : elle apparaît maintenant
  // dans son espace.
  const lienFiche = page.getByRole('link', { name: feiNumero! }).first();
  await expect(lienFiche).toBeVisible({ timeout: 15000 });
  await lienFiche.click();

  await expect(page.getByRole('heading', { name: 'Vente ou don' })).toBeVisible({ timeout: 15000 });

  // ETG 1 n'est pas un partenaire de User B : pas de raccourci, on passe par la liste.
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  // User B devient le détenteur courant en transmettant.
  const syncTransmissionParB = page.waitForResponse(
    (res) =>
      res.url().includes('/sync') &&
      res.request().method() === 'POST' &&
      res.ok() &&
      (res.request().postData() ?? '').includes(feiNumero!) &&
      (res.request().postData() ?? '').includes('"current_owner_user_name_cache":"Pierre Petit"'),
    { timeout: 15000 }
  );
  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await syncTransmissionParB;
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });
});
