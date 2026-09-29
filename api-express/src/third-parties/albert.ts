import { ALBERT_API_KEY, ALBERT_API_URL, ALBERT_MODEL } from '~/config';
import type { AlbertAssistantMessage, AlbertMessage } from '~/types/bug-investigation';

// Albert API (DINUM) expose une API compatible OpenAI : https://guides.ia.numerique.gouv.fr/albert-api

export interface AlbertTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const MAX_ATTEMPTS = 5;

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
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${ALBERT_API_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ALBERT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        // tool_choice vaut "none" par défaut chez Albert : sans "auto" explicite, le modèle n'appelle aucun outil
        ...(tools?.length ? { tools, tool_choice: toolChoice ?? 'auto' } : {}),
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (response.ok) {
      const json = await response.json();
      const choice = json.choices?.[0];
      if (!choice?.message)
        throw new Error(`Réponse Albert inattendue : ${JSON.stringify(json).slice(0, 500)}`);
      return {
        message: {
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls?.length ? choice.message.tool_calls : undefined,
        },
        finishReason: choice.finish_reason,
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
  }
}
