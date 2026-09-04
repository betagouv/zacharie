import { extractText, getDocumentProxy } from 'unpdf';
import { capture } from '~/third-parties/sentry';

/**
 * Extraction du texte d'un PDF (rapports COFRAC reçus par email).
 *
 * Un PDF « natif » (sorti d'un LIMS, d'un traitement de texte) porte son texte : on le lit.
 * Un PDF scanné ne porte que des images : l'extraction renvoie une chaîne vide, il n'y a rien
 * à en tirer sans OCR — l'appelant retombe alors sur le contenu de l'email.
 */

/**
 * Les extracteurs PDF découpent le texte en fragments : une référence peut ressortir
 * « P- 26- 000045 ». On recolle les traits d'union et on normalise les espaces avant
 * toute recherche de référence.
 */
export function normalizePdfText(text: string): string {
  return text
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Renvoie le texte normalisé du PDF, ou null si le document n'en porte aucun (scan, PDF illisible). */
export async function extractPdfText(body: Buffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(body));
    const { text } = await extractText(pdf, { mergePages: true });
    const normalized = normalizePdfText(Array.isArray(text) ? text.join(' ') : text);
    return normalized || null;
  } catch (error) {
    capture(error as Error, { extra: { context: 'extract_pdf_text' } });
    return null;
  }
}
