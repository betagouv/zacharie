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

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// PR #399 — `nextIsMyAssociation` branch of examinateur-select-next.tsx.
// Spec #08 already exercises the full transmission flow to an Association. This test focuses
// on what #08 doesn't verify: after the dispatch to ETG, the carcasse-level state has rolled
// from PREMIER_DETENTEUR → next_owner=ETG. Visible proof: the chasseur's step ladder
// (which is driven by carcasses[0].current_owner_role / next_owner_*) shows simpleStatus="En cours".
test('Examinateur → Association → ETG : step ladder advances based on per-carcasse fields', async ({
  page,
}) => {
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // PD = Association (entity). Triggers the `nextIsMyAssociation` branch.
  await page.getByRole('button', { name: /Association de chasseurs/i }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Une carcasse.
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  await page
    .getByRole('textbox', { name: 'Début de la chasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Début de la chasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Fin de l’examen initial' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Fin de l’examen initial' }).blur();

  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  // Inline transition → vente / don. Une seule carcasse : pas d'étape « Carcasses ».
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

  // Sync beacon — carcasse.next_owner_entity_id was written and pushed to backend.
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });

  // Now navigate back to the fiche page and assert the step state advanced.
  // The header reads `simpleStatus` from `useFeiSteps`, which derives from carcasses[0].
  // PD-side handoff complete → from chasseur perspective, status is "En cours" (ETG-bound).
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);
  await expect(page.getByText('En cours', { exact: true }).first()).toBeVisible({ timeout: 10000 });
});
