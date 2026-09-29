import { ALBERT_API_KEY, ALBERT_API_URL, ALBERT_MODEL } from '~/config';
import type { AlbertAssistantMessage, AlbertMessage, AlbertToolCall } from '~/types/bug-investigation';

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
  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
};

export type StreamState = { content: string; toolCalls: Array<AlbertToolCall>; finishReason: string };

// assemble les fragments du flux (format OpenAI) : le texte et les appels d'outils arrivent par morceaux
export function applyStreamChunk(
  state: StreamState,
  chunk: { choices?: Array<{ delta?: StreamDelta; finish_reason?: string | null }> }
) {
  const choice = chunk.choices?.[0];
  if (!choice) return;
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

async function readStream(response: Response, onActivity: () => void): Promise<StreamState> {
  const state: StreamState = { content: '', toolCalls: [], finishReason: '' };
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
  }
  return state;
}

export async function albertChatCompletion({
  model = ALBERT_MODEL,
  messages,
  tools,
  toolChoice,
}: {
  model?: string;
  messages: Array<AlbertMessage>;
  tools?: Array<AlbertTool>;
  toolChoice?: 'auto' | 'none';
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
        const state = await readStream(response, resetIdleTimer);
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
