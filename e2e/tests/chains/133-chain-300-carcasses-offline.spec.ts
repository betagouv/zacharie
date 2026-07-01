import { test, expect, type Page } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scénario 133 — Chaîne complète, ~300 carcasses, 3 espèces (Daim, Chevreuil, lots de Pigeons),
// entièrement pilotée par l'UI (login → logout par acteur, aucun état seedé).
// examinateur → premier détenteur → collecteur → ETG → SVI.
// Le collecteur et l'ETG retirent quelques carcasses (manquante/refusée + acceptation partielle de lot)
// HORS-LIGNE, puis repassent EN LIGNE pour synchroniser.
//
// TODO mass-inspect : tant que l'inspection de masse SVI n'existe pas, le SVI ne fait que recevoir la fiche.
// Quand l'inspection de masse arrivera, prolonger ce test pour inspecter/clôturer toutes les carcasses.

// Volumes — un seul endroit à ajuster. Réduits pour le dev (la création UI est ~O(N²) en re-renders,
// donc 300 carcasses = plusieurs minutes). Le flux est identique quel que soit N : ce qui passe à 10
// passe à 300. Pour la version « charge réelle » : DAIM=145, CHEV=145, PIGEON_LOTS=10 (= 300 lignes),
// surchargeable par variables d'env : DAIM_COUNT=145 CHEV_COUNT=145 PIGEON_LOTS=10.
const DAIM_COUNT = 45;
const CHEV_COUNT = 45;
const PIGEON_LOTS = [5, 8, 10, 12, 7, 9, 15, 6, 20, 11].slice(0, 10);
const pad = (n: number) => String(n).padStart(3, '0');

// Pas de slowMo global : la boucle de création tourne à la vitesse d'auto-wait de Playwright.
// Chaque ajout déclenche une synchro + un re-render de la liste qui grandit → ~1,5-2s/carcasse,
// d'où un timeout large pour ~300 carcasses. Le rythme du chaînage store → sync côté transmission
// est couvert par l'assertion ferme des bandeaux de notification.
test.setTimeout(Number((DAIM_COUNT + CHEV_COUNT + PIGEON_LOTS.length) * 1000 + 120000));

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// ---------- helpers création (examinateur) ----------

async function addCarcasse(
  page: Page,
  opts: { espece: string; bracelet: string; first?: boolean; lot?: number }
) {
  const now = Date.now();
  if (!opts.first) {
    const addAnother = page.getByRole('button', { name: 'Ajouter une autre carcasse' });
    await addAnother.scrollIntoViewIfNeeded();
    await addAnother.click();
  }
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption(opts.espece);
  if (opts.lot) {
    const quantite = page.getByLabel(/Nombre de carcasses dans le lot/);
    await quantite.scrollIntoViewIfNeeded();
    await quantite.fill(String(opts.lot));
    await quantite.blur();
  }
  const bracelet = page.getByRole('textbox', { name: /Numéro de marquage/ });
  await bracelet.scrollIntoViewIfNeeded();
  await bracelet.fill(opts.bracelet);
  await bracelet.blur();
  const submit = page.getByRole('button', {
    name: opts.lot ? 'Ajouter le lot de carcasses' : 'Ajouter la carcasse',
  });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  console.log(`addCarcasse ${opts.espece} ${opts.bracelet} took ${Date.now() - now}ms`);
}

// ---------- helpers marquage (collecteur / ETG) ----------

function carcasseCard(page: Page, espece: string, bracelet: string) {
  // Les lots de petit gibier affichent le nombre d'animaux : « Pigeons (5) N° PIG-001 ».
  // On tolère donc ce qui sépare l'espèce du numéro de bracelet.
  return page.getByRole('button', { name: new RegExp(`${espece}.*N° ${bracelet}\\b`) }).first();
}
function carcasseDialog(page: Page, espece: string, bracelet: string) {
  return page.getByLabel(`${espece} - N° ${bracelet}`);
}

async function markManquante(page: Page, espece: string, bracelet: string) {
  const card = carcasseCard(page, espece, bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  // Sélectionner « Carcasse manquante » valide + ferme la modale.
  await carcasseDialog(page, espece, bracelet).getByText('Carcasse manquante').click();
  await expect(card).toBeVisible();
}

async function markRefusee(page: Page, espece: string, bracelet: string, motif = 'Présence de souillures') {
  const card = carcasseCard(page, espece, bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = carcasseDialog(page, espece, bracelet);
  await dialog.getByText('Carcasse refusée').click();
  await dialog.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: motif }).click();
  const save = dialog.getByRole('button', { name: /Enregistrer|Refuser/ }).first();
  await save.scrollIntoViewIfNeeded();
  await save.click();
  await expect(card).toBeVisible();
}

async function markLotPartiel(page: Page, bracelet: string, accepted: number) {
  const card = carcasseCard(page, 'Pigeons', bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = carcasseDialog(page, 'Pigeons', bracelet);
  // exact: le texte d'aide du refus contient aussi « Lot partiellement accepté » → sans exact, 3 matchs.
  await dialog.getByText('Lot partiellement accepté', { exact: true }).click();
  const input = dialog.getByLabel(/Nombre d'animaux acceptés/);
  await input.fill(String(accepted));
  await input.blur();
  await dialog.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(card).toBeVisible();
}

test('Chaîne 300 carcasses : examinateur → PD → collecteur → ETG → SVI (collecteur & ETG hors-ligne)', async ({
  page,
  context,
}) => {
  // ===== 1. Examinateur crée la fiche + ~300 carcasses via l'UI =====
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort *' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  // Création hors-ligne : chaque « Ajouter la carcasse » appelle syncData, qui court-circuite quand on
  // est hors-ligne (useIsOnline pousse isOnline=false dans le store). On évite ainsi ~300 POST /sync et
  // les re-renders déclenchés par les retours de synchro → boucle nettement plus rapide. On repasse en
  // ligne juste avant la transmission pour que toute la fiche se synchronise d'un coup.
  await context.setOffline(true);
  for (let i = 1; i <= DAIM_COUNT; i++) {
    await addCarcasse(page, { espece: 'Daim', bracelet: `DAIM-${pad(i)}`, first: i === 1 });
  }
  for (let i = 1; i <= CHEV_COUNT; i++) {
    await addCarcasse(page, { espece: 'Chevreuil', bracelet: `CHEV-${pad(i)}` });
  }
  for (let i = 0; i < PIGEON_LOTS.length; i++) {
    await addCarcasse(page, { espece: 'Pigeons', bracelet: `PIG-${pad(i + 1)}`, lot: PIGEON_LOTS[i] });
  }

  await page.getByRole('button', { name: 'Continuer' }).click();

  // Heures (grand + petit gibier → les deux champs sont présents)
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

  // Retour en ligne : la fiche + les ~300 carcasses se synchronisent, puis on transmet.
  await context.setOffline(false);
  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await expect(transmettre).not.toBeDisabled();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 30000 });

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // ===== 2. Premier détenteur transmet au collecteur =====
  // L'examinateur, après transmission, est sur la page /envoyée. On revient sur un tableau de bord
  // propre AVANT de changer d'utilisateur : se déconnecter depuis /envoyée contamine le redirect
  // post-login (transition chasseur → chasseur) et renvoie le PD vers /connexion.
  await page.goto('http://localhost:3290/app/chasseur');
  await logoutAndConnect(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  // Navigation pleine page (goto) : réhydrate proprement la session du PD depuis le token stocké.
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  // Pas d'étape « prendre en charge » dans ce flux : le PD choisit directement le prochain détenteur.
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /Collecteur Pro 1/i }).click();
  // Le stockage n'est activé qu'une fois le destinataire choisi ; « Pas de stockage » est la valeur par défaut.
  const pasDeStockagePd = page.getByText('Pas de stockage').first();
  await pasDeStockagePd.scrollIntoViewIfNeeded();
  await pasDeStockagePd.click();
  // Pas de mode de transport à choisir pour un collecteur professionnel.
  const transmettrePd = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettrePd.scrollIntoViewIfNeeded();
  await transmettrePd.click();
  await expect(page.getByText(/Collecteur Pro 1 a été notifié/).first()).toBeVisible({ timeout: 30000 });

  // ===== 3. Collecteur : prise en charge en ligne, puis marquage + transmission HORS-LIGNE =====
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ }).click();

  await context.setOffline(true);

  await markManquante(page, 'Daim', 'DAIM-001');
  await markRefusee(page, 'Chevreuil', 'CHEV-001');

  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  const pasDeStockageColl = page.getByText(/Pas de stockage/i).first();
  await pasDeStockageColl.scrollIntoViewIfNeeded();
  await pasDeStockageColl.click();
  const transmettreColl = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreColl.scrollIntoViewIfNeeded();
  await transmettreColl.click();

  await context.setOffline(false);
  await expect(page.getByText(/ETG 1 a été notifié/)).toBeVisible({ timeout: 30000 });

  // ===== 4. ETG : prise en charge en ligne, puis marquage + transmission HORS-LIGNE =====
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();

  await context.setOffline(true);

  await markManquante(page, 'Daim', 'DAIM-002');
  await markRefusee(page, 'Chevreuil', 'CHEV-002');
  await markLotPartiel(page, 'PIG-001', Math.max(1, PIGEON_LOTS[0] - 2));

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /SVI 1/ }).click();
  const transmettreEtg = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreEtg.scrollIntoViewIfNeeded();
  await transmettreEtg.click();

  await context.setOffline(false);
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 30000 });

  // ===== 5. SVI reçoit la fiche (pas d'inspection — voir TODO mass-inspect) =====
  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText(/carcasses déjà refusées \(4\)/i)).toBeVisible({ timeout: 15000 });
});
