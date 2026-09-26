import type { Page } from '@playwright/test';
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
  venteDonModal,
} from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// Changer le propriétaire initial réécrit next_owner sur toutes les carcasses : une fois la fiche
// transmise en aval, cela annulait la transmission sans prévenir (le destinataire perdait la fiche).

function proprietaireInitialSelect(page: Page) {
  return page.locator('select[name="next_owner"]');
}

// Examinateur == PD via l'association : l'examen initial passe en ligne à la vue « vente / don ».
async function creerFicheJusquAuPremierDetenteur(page: Page) {
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

  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();
  // bascule en ligne vers la vue du premier détenteur
  await expect(page.getByRole('button', { name: /Ajouter une (autre )?vente/i }).first()).toBeVisible({
    timeout: 15000,
  });
}

test('Premier détenteur désigné, fiche pas encore transmise : le propriétaire initial reste modifiable', async ({
  page,
}) => {
  // l'association est désignée (next_owner_entity_id renseigné) mais rien n'est parti en aval
  await creerFicheJusquAuPremierDetenteur(page);

  const select = proprietaireInitialSelect(page);
  await select.scrollIntoViewIfNeeded();
  await expect(select).toBeEnabled();
});

test('Fiche transmise à un ETG pas encore prise en charge : le propriétaire initial est verrouillé', async ({
  page,
}) => {
  await creerFicheJusquAuPremierDetenteur(page);
  await openVenteDon(page);
  const etg1Pill = venteDonModal(page).getByRole('button', { name: /^ETG 1$/ });
  await expect(etg1Pill).toBeVisible({ timeout: 15000 });
  await etg1Pill.scrollIntoViewIfNeeded();
  await etg1Pill.click();

  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  // après transmission le chasseur est redirigé vers /envoyée
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });

  // revenir sur la fiche pour vérifier que le select est verrouillé
  const envoyeeUrl = page.url(); // …/fei/<numero>/envoyée
  const feiNumero = envoyeeUrl.match(/\/fei\/([^/]+)/)?.[1];
  expect(feiNumero, 'numéro de fiche introuvable dans l\'URL').toBeTruthy();
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);

  const select = proprietaireInitialSelect(page);
  await select.scrollIntoViewIfNeeded();
  await expect(select).toBeDisabled();
});
