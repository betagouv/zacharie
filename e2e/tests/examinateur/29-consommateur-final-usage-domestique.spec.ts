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

// Bloc 4 hintText shortcut: clicking « si vous êtes le consommateur final »
// sets `consommateur_final_usage_domestique` on the FEI (propagated to
// carcasses via `mapFeiFieldsToCarcasse`). The visible side-effect we assert
// here is the certification checkbox label — when consommateur_final is set,
// the " et que les carcasses en peau examinées ce jour peuvent être mises sur
// le marché" clause is dropped because the carcasses are not destined for the
// market. Clicking the button a second time toggles back to the market state.
test('Bloc 4 — toggle « consommateur final » updates cert label & button text', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Bloc 2 — 1 daim.
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
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

  // Set the approbation date via the first shortcut so the cert label renders fully.
  await page.getByRole('button', { name: 'Date du jour et maintenant' }).click();

  // Initial state (no consommateur_final): cert label contains the marché clause,
  // and the second hintText button proposes to mark the user as consommateur final.
  await expect(page.getByText(/peuvent être mises sur le marché/i).first()).toBeVisible();
  const setConsoBtn = page.getByRole('button', {
    name: /si vous êtes le consommateur final/i,
  });
  await expect(setConsoBtn).toBeVisible();

  // Toggle ON.
  await setConsoBtn.click();

  // Cert label no longer mentions "mise sur le marché".
  await expect(page.getByText(/peuvent être mises sur le marché/i)).toBeHidden();
  // And the second button now proposes the inverse action.
  const revertBtn = page.getByRole('button', {
    name: /si les carcasses sont destinées à une mise sur le marché/i,
  });
  await expect(revertBtn).toBeVisible();

  // Toggle OFF again. Marking the carcasses as consommateur final had set the
  // premier détenteur to the examinateur themselves; reverting clears it, so
  // Bloc 4 (and its cert label) collapses until a premier détenteur is re-selected.
  await revertBtn.click();
  await expect(page.getByText(/peuvent être mises sur le marché/i)).toBeHidden();

  // Re-select the premier détenteur to restore the market state, then verify the
  // cert label clause and the consommateur-final button are back.
  const reselectPd = page.locator('#select-next-owner').getByRole('button', { name: 'Continuer' });
  await reselectPd.scrollIntoViewIfNeeded();
  await reselectPd.click();
  await expect(page.getByText(/peuvent être mises sur le marché/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /si vous êtes le consommateur final/i })).toBeVisible();
});
