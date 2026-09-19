import * as mupdf from 'mupdf';
import { ALBERT_API_KEY, ALBERT_API_URL, ALBERT_OCR_MODEL } from '~/config';
import { capture } from './sentry';

/**
 * Albert API (albert.api.etalab.gouv.fr) — OCR des rapports d'analyses que les laboratoires
 * envoient scannés. Sur les rapports réels reçus, 3 sur 4 sont des images sans texte : sans OCR
 * ils ne sont ni rattachables ni lisibles.
 *
 * On n'utilise **pas** `POST /v1/ocr` : cet endpoint exige un modèle de type `image-to-text`,
 * et le catalogue n'en propose aucun (uniquement des `image-text-to-text`). On passe donc par
 * `POST /v1/chat/completions` avec un modèle de vision, en lui donnant les pages en images.
 *
 * Le PDF est rastérisé ici (mupdf, WASM — pas de binaire natif à installer) : le document ne
 * sort jamais de notre infrastructure autrement que sous forme d'image dans l'appel.
 */

export const IS_ALBERT_CONFIGURED = !!ALBERT_API_KEY;

// 150 dpi : lisible par le modèle sans faire exploser la taille de la requête (~350 Ko par page A4)
const DPI = 150;
// Un rapport tient sur quelques pages ; au-delà on ne lit que le début plutôt que d'épuiser le quota
const MAX_PAGES = 10;
// Une page dense (tableau d'échantillons) tient largement dedans
const MAX_TOKENS = 8000;
// L'OCR d'une page prend quelques secondes : appelé depuis un cron, jamais dans le fil d'une requête
const OCR_TIMEOUT_MS = 180_000;

const PROMPT = 'Transcris intégralement le texte de ce document, tableaux compris.';

async function ocrImage(png: Buffer): Promise<string | null> {
  try {
    const response = await fetch(`${ALBERT_API_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ALBERT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ALBERT_OCR_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${png.toString('base64')}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
    if (!response.ok) {
      capture('Albert OCR: réponse en erreur', {
        extra: { status: String(response.status), body: (await response.text()).slice(0, 500) },
      });
      return null;
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    capture(error as Error, { extra: { context: 'albert_ocr' } });
    return null;
  }
}

/** Rend chaque page d'un PDF en PNG. Renvoie un tableau vide si le document est illisible. */
function rasteriserPdf(body: Buffer): Buffer[] {
  try {
    const document = mupdf.Document.openDocument(new Uint8Array(body), 'application/pdf');
    const pages: Buffer[] = [];
    const total = Math.min(document.countPages(), MAX_PAGES);
    for (let index = 0; index < total; index++) {
      const pixmap = document
        .loadPage(index)
        .toPixmap(mupdf.Matrix.scale(DPI / 72, DPI / 72), mupdf.ColorSpace.DeviceRGB, false, true);
      pages.push(Buffer.from(pixmap.asPNG()));
    }
    return pages;
  } catch (error) {
    capture(error as Error, { extra: { context: 'rasteriser_pdf' } });
    return [];
  }
}

/**
 * Texte lu dans un document (PDF scanné ou image), page par page.
 * Renvoie null si rien n'a pu être lu — l'appelant laisse alors la saisie à la main.
 */
export async function ocrDocument(body: Buffer, contentType: string): Promise<string | null> {
  if (!IS_ALBERT_CONFIGURED) return null;

  const images = contentType === 'application/pdf' ? rasteriserPdf(body) : [body];
  if (!images.length) return null;

  const pages: string[] = [];
  // Séquentiel : les quotas Albert se comptent en requêtes par minute
  for (const image of images) {
    const texte = await ocrImage(image);
    if (texte) pages.push(texte);
  }
  return pages.length ? pages.join('\n') : null;
}
