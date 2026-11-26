import { expect, type Page } from '@playwright/test';

export const venteDonModal = (page: Page) => page.locator('#dispatch-modal-pd');

export const carcassesRetenues = (page: Page) =>
  venteDonModal(page)
    .locator('#vente-don-carcasses-retenues')
    .getByRole('button', { name: /^Retirer / });

export const carcassesRetirees = (page: Page) =>
  venteDonModal(page)
    .locator('#vente-don-carcasses-retirees')
    .getByRole('button', { name: /^Remettre / });

export const carcassesAutreLot = (page: Page) =>
  venteDonModal(page)
    .locator('#vente-don-carcasses-part-ailleurs')
    .getByRole('button', { name: /^Remettre / });

export async function openVenteDon(page: Page) {
  const addCard = page.getByRole('button', { name: /Ajouter un destinataire/i }).first();
  await addCard.scrollIntoViewIfNeeded();
  await addCard.click();
  await expect(venteDonModal(page)).toBeVisible({ timeout: 10000 });
}

function radioLabel(page: Page, texte: string) {
  return venteDonModal(page).getByText(texte).first().locator('xpath=ancestor-or-self::label[1]');
}

export async function choisirRepartition(page: Page, choix: 'toutes' | 'partie') {
  const label = choix === 'toutes' ? 'Toutes les carcasses restantes' : 'Une partie seulement';
  const radio = radioLabel(page, label);
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

export async function garderCarcasses(page: Page, indices: Array<number>) {
  await choisirRepartition(page, 'partie');
  const tags = venteDonModal(page).getByRole('button', { name: /^(Retirer|Remettre) / });
  await expect(tags.first()).toBeVisible({ timeout: 10000 });
  const noms = await tags.evaluateAll((elements) =>
    elements.map((element) => (element.getAttribute('aria-label') ?? '').replace(/^\S+ /, ''))
  );
  for (const [index, nom] of noms.entries()) {
    const verbe = indices.includes(index) ? 'Remettre' : 'Retirer';
    const tag = venteDonModal(page).getByRole('button', { name: `${verbe} ${nom}`, exact: true });
    if ((await tag.count()) === 0) continue;
    await tag.scrollIntoViewIfNeeded();
    await tag.click();
  }
}

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
  const modal = venteDonModal(page);
  await expect(modal.getByText('Prochain détenteur des carcasses').first()).toBeVisible({ timeout: 10000 });

  const radio = modal.getByRole('radio', { name: optionName });
  if ((await radio.count()) > 0) {
    const label = modal.locator(`label[for="${await radio.first().getAttribute('id')}"]`);
    await label.scrollIntoViewIfNeeded();
    await label.click();
    await expect(radio.first()).toBeChecked();
    return;
  }

  const recherche = await ouvrirRechercheDestinataire(page);
  await recherche.fill(typeof optionName === 'string' ? optionName : optionName.source.replace(/\\/g, ''));
  const resultat = modal.getByRole('button', { name: optionName }).first();
  await resultat.scrollIntoViewIfNeeded();
  await resultat.click();
}

export async function ouvrirRechercheDestinataire(page: Page) {
  const modal = venteDonModal(page);
  const autreDestinataire = modal.getByRole('button', { name: 'Envoyer à un autre destinataire' });
  if (await autreDestinataire.isVisible()) {
    await autreDestinataire.scrollIntoViewIfNeeded();
    await autreDestinataire.click();
  }
  const recherche = modal.getByPlaceholder('Tapez le nom du destinataire');
  await recherche.scrollIntoViewIfNeeded();
  return recherche;
}

export async function creerDestinataire(page: Page, nom: string) {
  const modal = venteDonModal(page);
  await expect(modal.getByText('Prochain détenteur des carcasses').first()).toBeVisible({ timeout: 10000 });
  const recherche = await ouvrirRechercheDestinataire(page);
  await recherche.fill(nom);
  const creer = modal.getByRole('button', { name: `Créer « ${nom} »` });
  await creer.scrollIntoViewIfNeeded();
  await creer.click();
  await expect(modal.getByText('Ajouter un destinataire')).toBeVisible({ timeout: 10000 });
}

export async function selectCcg(page: Page, optionName: string | RegExp) {
  const select = venteDonModal(page).locator("[class*='select-ccg'][class*='input-container']");
  await select.scrollIntoViewIfNeeded();
  await select.click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function choisirStockage(page: Page, stockage: 'aucun' | 'ccg') {
  const label = stockage === 'aucun' ? 'Pas de stockage' : 'Carcasses déposées dans une chambre froide';
  const radio = radioLabel(page, label);
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

export async function choisirTransport(page: Page, transport: 'moi' | 'collecteur') {
  const label =
    transport === 'moi'
      ? 'Je transporte les carcasses moi'
      : 'Le transport est réalisé par un collecteur professionnel';
  const radio = radioLabel(page, label);
  await radio.scrollIntoViewIfNeeded();
  await radio.click();
}

export async function remplirDateMaintenant(page: Page) {
  const raccourci = venteDonModal(page)
    .getByRole('button', { name: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/ })
    .first();
  await raccourci.scrollIntoViewIfNeeded();
  await raccourci.click();
}

const ETAPES = ['Destinataire', 'Carcasses', 'Stockage', 'Transport'] as const;
export type EtapeVenteDon = (typeof ETAPES)[number];

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

export function etapeCourante(page: Page) {
  return venteDonModal(page).locator('#vente-don-etape-courante');
}

interface VenteDon {
  destinataire: string | RegExp;
  carcasses?: number[];
  ccg?: string | RegExp;
  transport?: 'moi' | 'collecteur';
}

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
