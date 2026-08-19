import { expect, type Page } from '@playwright/test';

// Le premier détenteur répartit ses carcasses en « ventes / dons » : une carte par destinataire,
// remplie dans une modale à étapes (Destinataire → Carcasses → Stockage → Transport).
// L'étape Carcasses n'existe que s'il reste plus d'une carcasse à répartir, l'étape Transport
// seulement quand le premier détenteur doit l'organiser (ni collecteur, ni circuit court).
// Voir app-local-first-react-router/src/routes/chasseur/premier-detenteur-select-next.tsx

export const venteDonModal = (page: Page) => page.locator('#dispatch-modal-pd');

// Cases à cocher de l'étape « Carcasses » (une par carcasse restante).
export const carcassesAAttribuer = (page: Page) => venteDonModal(page).getByRole('checkbox');

export async function openVenteDon(page: Page) {
  const addCard = page.getByRole('button', { name: /Ajouter une (autre )?vente/i }).first();
  await addCard.scrollIntoViewIfNeeded();
  await addCard.click();
  await expect(venteDonModal(page)).toBeVisible({ timeout: 10000 });
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

// Titre de l'étape courante affiché par le Stepper DSFR.
export function etapeCourante(page: Page) {
  return venteDonModal(page).locator('.fr-stepper__title');
}

interface VenteDon {
  destinataire: string | RegExp;
  // Indices des carcasses à (dé)cocher dans l'étape « Carcasses ».
  // Par défaut on garde la sélection proposée : tout pour la 1re vente / le 1er don, rien ensuite.
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
    for (const index of venteDon.carcasses) {
      await carcassesAAttribuer(page).nth(index).click();
    }
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
