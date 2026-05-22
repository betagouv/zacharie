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

// PR #399 — `nextIsMe` branch of examinateur-select-next.tsx.
// The examinateur picks THEMSELVES as PD. Two observable outcomes:
// 1. After the first Transmettre, the form transitions inline to the PD dispatch view
//    (no separate "Votre fiche a été transmise" confirmation page since it's a self-handoff).
// 2. The carcasse-level `current_owner_role` has flipped to PREMIER_DETENTEUR, which is
//    what surfaces the dispatch UI.
// Distinct from spec #08 which exercises `nextIsMyAssociation` (Association entity, not the user).
test('Examinateur picks themselves as PD — inline transition to dispatch view', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Utiliser' }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Heures.
  await page
    .getByRole('textbox', { name: 'Heure de mise à mort de la' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure de mise à mort de la' }).blur();
  await page
    .getByRole('textbox', { name: "Heure d'éviscération de la" })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: "Heure d'éviscération de la" }).blur();

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

  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});
