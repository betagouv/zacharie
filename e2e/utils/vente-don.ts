import { expect, type Page } from '@playwright/test';

// Le premier détenteur répartit ses carcasses en « ventes / dons » : une carte par destinataire,
// remplie dans une modale à étapes (Destinataire → Carcasses → Stockage → Transport).
// L'étape Transport n'existe que quand le premier détenteur doit l'organiser (ni collecteur,
// ni circuit court).
// Voir app-local-first-react-router/src/routes/chasseur/premier-detenteur-select-next.tsx

export const venteDonModal = (page: Page) => page.locator('#dispatch-modal-pd');

// Étape « Carcasses » : on part de « toutes », et on retire les carcasses qui ne partent pas.
// Chaque carcasse est un tag cliquable, dans l'une des deux zones.
export const carcassesRetenues = (page: Page) =>
  venteDonModal(page).locator('#vente-don-carcasses-retenues').getByRole('button');

export const carcassesRetirees = (page: Page) =>
  venteDonModal(page).locator('#vente-don-carcasses-retirees').getByRole('button');

export async function openVenteDon(page: Page) {
  const addCard = page.getByRole('button', { name: /Ajouter une (autre )?vente/i }).first();
  await addCard.scrollIntoViewIfNeeded();
  await addCard.click();
  await expect(venteDonModal(page)).toBeVisible({ timeout: 10000 });
}

export async function choisirRepartition(page: Page, choix: 'toutes' | 'partie') {
  const label = choix === 'toutes' ? 'Toutes mes carcasses' : 'Une partie seulement';
  const radio = venteDonModal(page).getByText(label).first();
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

// Ne garde que les carcasses aux indices donnés. L'ordre de référence est celui de la zone
// « Part chez … » juste après être passé sur « Une partie seulement » : tout y est encore retenu.
export async function garderCarcasses(page: Page, indices: Array<number>) {
  // Passage par « toutes » : sur une 2e vente / un 2e don la modale s'ouvre déjà sur « une partie »
  // avec zéro carcasse retenue, et recliquer un radio déjà coché ne déclenche rien.
  await choisirRepartition(page, 'toutes');
  await choisirRepartition(page, 'partie');
  const tags = carcassesRetenues(page);
  await expect(tags.first()).toBeVisible({ timeout: 10000 });
  const labels = await tags.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('aria-label') ?? '')
  );
  for (const [index, label] of labels.entries()) {
    if (indices.includes(index)) continue;
    const tag = venteDonModal(page).getByRole('button', { name: label, exact: true });
    await tag.scrollIntoViewIfNeeded();
    await tag.click();
  }
}

// `nom` = l'intitulé du tag, ex. « Daim N° MM-001-002 ».
export async function retirerCarcasse(page: Page, nom: string) {
  const tag = venteDonModal(page).getByRole('button', { name: `Retirer ${nom}` });
  await tag.scrollIntoViewIfNeeded();
  await tag.click();
}

export async function remettreCarcasse(page: Page, nom: string) {
  const tag = venteDonModal(page).getByRole('button', { name: `Remettre ${nom}` });
  await tag.scrollIntoViewIfNeeded();
  await tag.click();
}

export async function selectDestinataire(page: Page, optionName: string | RegExp) {
  const select = venteDonModal(page).locator(
    "[class*='select-prochain-detenteur'][class*='input-container']"
  );
  await select.scrollIntoViewIfNeeded();
  await select.click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function selectCcg(page: Page, optionName: string | RegExp) {
  const select = venteDonModal(page).locator("[class*='select-ccg'][class*='input-container']");
  await select.scrollIntoViewIfNeeded();
  await select.click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function choisirStockage(page: Page, stockage: 'aucun' | 'ccg') {
  const label = stockage === 'aucun' ? 'Pas de stockage' : 'Carcasses déposées dans une chambre froide';
  const radio = venteDonModal(page).getByText(label).first();
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

export async function choisirTransport(page: Page, transport: 'moi' | 'collecteur') {
  const label =
    transport === 'moi'
      ? 'Je transporte les carcasses moi'
      : 'Le transport est réalisé par un collecteur professionnel';
  const radio = venteDonModal(page).getByText(label).first();
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

// Raccourci « maintenant » des champs date : le libellé est la date du jour formatée (DD/MM/YYYY HH:mm).
export async function remplirDateMaintenant(page: Page) {
  const raccourci = venteDonModal(page)
    .getByRole('button', { name: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/ })
    .first();
  await raccourci.scrollIntoViewIfNeeded();
  await raccourci.click();
}

// Étapes possibles de la modale, dans l'ordre.
const ETAPES = ['Destinataire', 'Carcasses', 'Stockage', 'Transport'] as const;
export type EtapeVenteDon = (typeof ETAPES)[number];

// Avance jusqu'à l'étape voulue. Les étapes « Carcasses » et « Transport » n'existent pas
// toujours : on se cale sur le titre du Stepper plutôt que sur un nombre de clics.
export async function allerAEtape(page: Page, etape: EtapeVenteDon) {
  for (let i = 0; i < ETAPES.length; i++) {
    const titre = (await etapeCourante(page).textContent()) ?? '';
    if (titre.startsWith(etape)) return;
    await etapeSuivante(page);
  }
  await expect(etapeCourante(page)).toContainText(etape);
}

export async function etapeSuivante(page: Page) {
  const suivant = venteDonModal(page).getByRole('button', { name: 'Suivant', exact: true });
  await suivant.scrollIntoViewIfNeeded();
  await suivant.click();
}

export async function etapePrecedente(page: Page) {
  const precedent = venteDonModal(page).getByRole('button', { name: 'Précédent', exact: true });
  await precedent.scrollIntoViewIfNeeded();
  await precedent.click();
}

export async function enregistrerVenteDon(page: Page) {
  const enregistrer = venteDonModal(page).getByRole('button', { name: 'Enregistrer', exact: true });
  await enregistrer.scrollIntoViewIfNeeded();
  await enregistrer.click();
  await expect(venteDonModal(page)).toBeHidden({ timeout: 10000 });
}

// Titre de l'étape courante affiché en tête de la modale.
export function etapeCourante(page: Page) {
  return venteDonModal(page).locator('#vente-don-etape-courante');
}

interface VenteDon {
  destinataire: string | RegExp;
  // Indices des carcasses à GARDER pour cette vente / ce don (les autres sont retirées).
  // Par défaut on garde la proposition « toutes mes carcasses ».
  carcasses?: number[];
  // Stockage en chambre froide. Sans ccg : « pas de stockage ».
  ccg?: string | RegExp;
  transport?: 'moi' | 'collecteur';
}

// Ajoute une vente / un don complète depuis la carte d'ajout jusqu'à l'enregistrement.
export async function ajouterVenteDon(page: Page, venteDon: VenteDon) {
  await openVenteDon(page);
  await selectDestinataire(page, venteDon.destinataire);

  if (venteDon.carcasses) {
    await allerAEtape(page, 'Carcasses');
    await garderCarcasses(page, venteDon.carcasses);
  }

  await allerAEtape(page, 'Stockage');
  if (venteDon.ccg) {
    await choisirStockage(page, 'ccg');
    await selectCcg(page, venteDon.ccg);
    await remplirDateMaintenant(page);
  } else {
    await choisirStockage(page, 'aucun');
  }

  // L'étape « Transport » n'existe que si le premier détenteur doit l'organiser : sur la dernière
  // étape la modale propose « Enregistrer » à la place de « Suivant ».
  const aUneEtapeTransport = await venteDonModal(page)
    .getByRole('button', { name: 'Suivant', exact: true })
    .isVisible();
  if (aUneEtapeTransport) {
    await allerAEtape(page, 'Transport');
    const transport = venteDon.transport ?? 'moi';
    await choisirTransport(page, transport);
    if (venteDon.ccg && transport === 'moi') {
      await remplirDateMaintenant(page);
    }
  }

  await enregistrerVenteDon(page);
}
