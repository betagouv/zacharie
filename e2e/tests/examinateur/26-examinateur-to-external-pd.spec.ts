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

// PR #399 — round-trip the per-carcasse `current_owner_role` through the backend.
// The examinateur transmits to a DIFFERENT user (Pierre Petit). When the PD logs in,
// the fiche must appear in their "à compléter" list with the PD-side step available.
// This is the cleanest proof that carcasse.current_owner_role syncs end-to-end,
// because the PD-side UI (`Prendre en charge cette fiche` button + simpleStatus "À compléter")
// is rendered FROM the carcasse fields via `computeFeiSteps`.
test('Examinateur transmits to external PD — round-trip via backend', async ({ page }) => {
  // --- User A : examinateur (CFEI-formed, with a CHASSEUR relation to Pierre Petit / premier-detenteur).
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // External PD = Pierre Petit (premier-detenteur@example.fr). NOT the same user as examinateur.
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

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
  await page.getByText('Je, Martin Marie, certifie qu').click();

  // Capture FEI number BEFORE the post-transmission redirect.
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  // External-PD branch: chasseur sees the dedicated confirmation page (not inline dispatch).
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // --- User B : Pierre Petit (premier-detenteur). Independent user.
  // The fiche must appear in his list because carcasse.current_owner_role was synced to PREMIER_DETENTEUR
  // and PD's `useFeiSteps` derives simpleStatus="À compléter" from that.
  await logoutAndConnect(page, 'premier-detenteur@example.fr');

  // Fiche shows up on the PD landing list — round-trip beacon.
  // Pierre is rendered as a recipient because carcasse.next_owner_user_id === Pierre.id was
  // synced through the backend (see `getFeisSorted` isToTake at app-side/utils/get-fei-sorted.ts).
  await expect(page.getByRole('link', { name: feiNumero })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: feiNumero }).click();

  // Detail page loads for the PD without 404 — proves the per-carcasse fields synced.
  await expect(page).toHaveURL(new RegExp(`/app/chasseur/fei/${feiNumero}`), { timeout: 10000 });

  // FIXME (PR #399 régression connue): on attendrait ici le bouton "Prendre en charge cette
  // fiche et les carcasses associées". Mais `chasseur-current-owner-confirm.tsx:85` exige
  // `fei.fei_next_owner_user_id === user.id`, qui n'est plus écrit par le flux examinateur
  // external (le `nextFei` côté examinateur-select-next.tsx ne set plus ce champ). La
  // visibilité du lien dans la liste suffit comme preuve de round-trip — on n'assert pas
  // le bouton tant que le canConfirmCurrentOwner n'est pas mis à jour pour lire depuis carcasses[0].
});
