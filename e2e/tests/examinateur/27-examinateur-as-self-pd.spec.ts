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

// PR #399 — `nextIsMe` branch of examinateur-select-next.tsx.
//
// FIXME: marked `.fixme` because the PR removed the argument from the only call site:
//   `handleSubmitFromSelect(nextOwnerUser?.id)` → `handleSubmitFromSelect()`
// so `nextOwnerUserId` is always `undefined` and `nextIsMe = (undefined === user.id)` is
// always false. The `nextIsMe` branch is now unreachable; picking yourself falls through
// to the external branch instead. Restore the arg at the call site (and adjust the carcasse
// transmission to clear next_owner_user_id on self-handoff) before un-fixme-ing this test.
//
// Expected behavior once fixed: the user picks themselves as PD; after Transmettre, the form
// transitions inline to the PD dispatch view (ETG 1 pill visible) — no "Votre fiche a été
// transmise" page. Distinct from spec #08 which already covers `nextIsMyAssociation`.
test.fixme('Examinateur picks themselves as PD — inline transition to dispatch view', async ({ page }) => {
  // `examinateur@example.fr` (Marie Martin) is a CHASSEUR with CFEI formation. The API
  // unconditionally unshifts the current user into `detenteursInitiaux` for chasseurs, so
  // her own pill ("Marie Martin") appears in the destinataire selector.
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  // Pick MYSELF as PD. This is what triggers the `nextIsMe` branch.
  await page.getByRole('button', { name: 'Marie Martin' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Bloc 2 — une carcasse.
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Heures.
  await page
    .getByRole('textbox', { name: 'Début de la chasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Début de la chasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Fin de l’examen initial' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Fin de l’examen initial' }).blur();

  // Validation.
  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();
  await page.getByText('Je, Martin Marie, certifie qu').click();

  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  // Self-handoff: the form transitions INLINE to the dispatch view. ETG 1 pill appears
  // because the user can now pick a recipient — this only renders when the carcasse-level
  // current_owner_role is PREMIER_DETENTEUR (the dispatch destinataire selector reads from carcasses).
  const etg1Pill = page.getByRole('button', { name: /ETG 1/i });
  await expect(etg1Pill).toBeVisible({ timeout: 15000 });

  // No "Votre fiche a été transmise" page on self-handoff.
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeHidden();

  // Complete the dispatch to confirm the full PD flow works post-self-handoff.
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

  await expect(page.getByText(/Votre fiche a été transmise à ETG 1/i)).toBeVisible({ timeout: 10000 });
});
