import { ALBERT_API_KEY, ALBERT_API_URL, ALBERT_MODEL, ALBERT_OCR_MODEL } from '~/config';
import type { AlbertAssistantMessage, AlbertMessage, AlbertToolCall } from '~/types/bug-investigation';
import { capture } from './sentry';

// Albert API (DINUM) expose une API compatible OpenAI : https://guides.ia.numerique.gouv.fr/albert-api

export interface AlbertTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const MAX_ATTEMPTS = 5;
const MAX_NETWORK_ATTEMPTS = 2;
// les modèles à raisonnement peuvent réfléchir plusieurs minutes : on répond en streaming et on
// n'abandonne que si Albert ne renvoie plus rien
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_CALL_DURATION_MS = 10 * 60 * 1000;

type StreamDelta = {
  content?: string | null;
  // texte de réflexion des modèles à raisonnement (le nom du champ dépend de la version de vLLM)
  reasoning_content?: string | null;
  reasoning?: string | null;
  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
};

export type StreamState = {
  reasoning: string;
  content: string;
  toolCalls: Array<AlbertToolCall>;
  finishReason: string;
};

// assemble les fragments du flux (format OpenAI) : le texte et les appels d'outils arrivent par morceaux
export function applyStreamChunk(
  state: StreamState,
  chunk: { choices?: Array<{ delta?: StreamDelta; finish_reason?: string | null }> }
) {
  const choice = chunk.choices?.[0];
  if (!choice) return;
  const reasoning = choice.delta?.reasoning_content ?? choice.delta?.reasoning;
  if (reasoning) state.reasoning += reasoning;
  if (choice.delta?.content) state.content += choice.delta.content;
  for (const toolCallDelta of choice.delta?.tool_calls ?? []) {
    const toolCall = (state.toolCalls[toolCallDelta.index] ??= {
      id: '',
      type: 'function',
      function: { name: '', arguments: '' },
    });
    if (toolCallDelta.id) toolCall.id = toolCallDelta.id;
    if (toolCallDelta.function?.name) toolCall.function.name += toolCallDelta.function.name;
    if (toolCallDelta.function?.arguments) toolCall.function.arguments += toolCallDelta.function.arguments;
  }
  if (choice.finish_reason) state.finishReason = choice.finish_reason;
}

async function readStream(
  response: Response,
  onActivity: () => void,
  onProgress?: (state: StreamState) => void
): Promise<StreamState> {
  const state: StreamState = { reasoning: '', content: '', toolCalls: [], finishReason: '' };
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onActivity();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, '').trim();
      if (!line.startsWith('data:') || !data || data === '[DONE]') continue;
      applyStreamChunk(state, JSON.parse(data));
    }
    onProgress?.(state);
  }
  return state;
}

export async function albertChatCompletion({
  model = ALBERT_MODEL,
  messages,
  tools,
  toolChoice,
  onProgress,
}: {
  model?: string;
  messages: Array<AlbertMessage>;
  tools?: Array<AlbertTool>;
  toolChoice?: 'auto' | 'none';
  onProgress?: (state: StreamState) => void;
}): Promise<{ message: AlbertAssistantMessage; finishReason: string }> {
  if (!ALBERT_API_KEY) throw new Error('ALBERT_API_KEY manquante');
  let networkAttempts = 0;
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    let abortReason = '';
    const abort = (reason: string) => {
      abortReason = reason;
      controller.abort();
    };
    let idleTimer = setTimeout(
      () => abort(`aucune réponse d'Albert pendant ${IDLE_TIMEOUT_MS / 60000} min`),
      IDLE_TIMEOUT_MS
    );
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => abort(`aucune réponse d'Albert pendant ${IDLE_TIMEOUT_MS / 60000} min`),
        IDLE_TIMEOUT_MS
      );
    };
    const hardTimer = setTimeout(
      () => abort(`réponse d'Albert trop longue (plus de ${MAX_CALL_DURATION_MS / 60000} min)`),
      MAX_CALL_DURATION_MS
    );
    try {
      const response = await fetch(`${ALBERT_API_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ALBERT_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          // tool_choice vaut "none" par défaut chez Albert : sans "auto" explicite, le modèle n'appelle aucun outil
          ...(tools?.length ? { tools, tool_choice: toolChoice ?? 'auto' } : {}),
          temperature: 0.2,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        const state = await readStream(response, resetIdleTimer, onProgress);
        const toolCalls = state.toolCalls.filter((toolCall) => toolCall.function.name);
        return {
          message: {
            role: 'assistant',
            content: state.content || null,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          },
          finishReason: state.finishReason,
        };
      }
      // quota (429) ou indisponibilité passagère : on réessaie avec un délai croissant
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        throw new Error(`Albert API ${response.status} : ${(await response.text()).slice(0, 500)}`);
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      const delayMs = retryAfter > 0 ? retryAfter * 1000 : 10_000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      if ((error as Error).message.startsWith('Albert API')) throw error;
      // coupure réseau ou délai dépassé : un seul nouvel essai
      networkAttempts++;
      if (networkAttempts >= MAX_NETWORK_ATTEMPTS) {
        throw new Error(`Albert API injoignable : ${abortReason || (error as Error).message}`);
      }
    } finally {
      clearTimeout(idleTimer);
      clearTimeout(hardTimer);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* OCR des rapports d'analyses trichine                                       */
/* -------------------------------------------------------------------------- */

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

/**
 * Rend chaque page d'un PDF en PNG. Renvoie un tableau vide si le document est illisible.
 * mupdf (10 Mo de WASM) est chargé à la demande : seul l'OCR en a besoin, pas le démarrage de l'API.
 */
async function rasteriserPdf(body: Buffer): Promise<Buffer[]> {
  try {
    // @ts-expect-error TS1323 : le tsconfig ne déclare pas de `module`, l'import dynamique fonctionne sous tsx
    const mupdf = await import('mupdf');
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

  const images = contentType === 'application/pdf' ? await rasteriserPdf(body) : [body];
  if (!images.length) return null;

  const pages: string[] = [];
  // Séquentiel : les quotas Albert se comptent en requêtes par minute
  for (const image of images) {
    const texte = await ocrImage(image);
    if (texte) pages.push(texte);
  }
  return pages.length ? pages.join('\n') : null;
}
