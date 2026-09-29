import type { Page } from '@playwright/test';
import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';
import { dateApprobationDuJour } from '../../utils/date-approbation';
import {
  openVenteDon,
  allerAEtape,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
  venteDonModal,
} from '../../utils/vente-don';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

function proprietaireInitialSelect(page: Page) {
  return page.locator('select[name="next_owner"]');
}

// Scenario 34 — Fiche transmise à l'ETG puis renvoyée. Le chasseur change de propriétaire initial,
// puis remet l'association : les carcasses portent alors next_owner_entity_id = l'association (rôle
// PREMIER_DETENTEUR). Elles ne doivent pas apparaître comme une vente déjà transmise à l'ETG.
test("Renvoi par l'ETG puis retour à l'association : aucune vente fantôme, la fiche reste à transmettre", async ({
  page,
}) => {
  // Chasseur en mobile, ETG en desktop
  await page.setViewportSize({ width: 350, height: 667 });
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

  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

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
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });

  // L'ETG renvoie la fiche à l'expéditeur
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  const etgLink = page.getByRole('link', { name: new RegExp(feiNumero!) });
  await expect(etgLink).toBeVisible({ timeout: 10000 });
  await etgLink.click();
  const returnBtn = page.getByRole('button', { name: /Renvoyer à l'expéditeur/ });
  await expect(returnBtn).toBeVisible({ timeout: 10000 });
  await returnBtn.scrollIntoViewIfNeeded();
  await returnBtn.click();
  await page.getByRole('button', { name: 'Confirmer le renvoi' }).click();
  await expect(page.getByText("La fiche a été renvoyée à l'expéditeur")).toBeVisible({ timeout: 10000 });

  // Le chasseur change de propriétaire initial, puis remet l'association
  await page.setViewportSize({ width: 350, height: 667 });
  await logoutAndConnect(page, 'examinateur-premier-detenteur@example.fr');
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);

  const select = proprietaireInitialSelect(page);
  await select.scrollIntoViewIfNeeded();
  await expect(select).toBeEnabled({ timeout: 10000 });
  await select.selectOption('new-user');
  await page.getByLabel("Saisissez l'email du propriétaire initial").fill('premier-detenteur@example.fr');
  const rechercher = page.locator('#content').getByRole('button', { name: 'Rechercher' });
  await rechercher.scrollIntoViewIfNeeded();
  await rechercher.click();
  const continuer = page.getByRole('button', { name: 'Continuer' }).first();
  await continuer.scrollIntoViewIfNeeded();
  await continuer.click();
  await expect(select).toHaveValue('0Y545', { timeout: 10000 });

  await select.scrollIntoViewIfNeeded();
  await select.selectOption('5b916331-632e-4c29-be2e-12a834e92688');
  await continuer.scrollIntoViewIfNeeded();
  await continuer.click();
  await expect(select).toHaveValue('5b916331-632e-4c29-be2e-12a834e92688', { timeout: 10000 });

  // La carcasse est à attribuer de nouveau, pas « Envoyée à ETG 1 », et on peut créer une vente
  await expect(page.getByText(/Renvoyée par ETG 1, à attribuer de nouveau/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Envoyée à ETG 1/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ajouter une (autre )?vente/i }).first()).toBeVisible();
});
