import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('~/config', () => ({
  ALBERT_API_KEY: 'test-key',
  ALBERT_API_URL: 'https://albert.test/v1',
  ALBERT_MODEL: 'deepseek-test',
}));

import { albertChatCompletion } from '~/third-parties/albert';

function sseResponse(chunks: Array<unknown>) {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
  const encoded = new TextEncoder().encode(body);
  // on coupe le flux au milieu d'une ligne pour vérifier le réassemblage
  const middle = Math.floor(encoded.length / 2);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded.slice(0, middle));
      controller.enqueue(encoded.slice(middle));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('albertChatCompletion', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test('assemble le texte et les appels d’outils reçus en streaming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          { choices: [{ delta: { reasoning_content: 'je réfléchis' } }] },
          { choices: [{ delta: { content: 'Je regarde ' } }] },
          { choices: [{ delta: { content: 'la chronologie.' } }] },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id: 'call-1', function: { name: 'fei_timeline', arguments: '{"fei_' } },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              { delta: { tool_calls: [{ index: 0, function: { arguments: 'numero":"ZACH-1"}' } }] } },
            ],
          },
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        ])
      )
    );

    const { message, finishReason } = await albertChatCompletion({
      messages: [{ role: 'user', content: 'x' }],
    });

    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({
      model: 'deepseek-test',
      stream: true,
    });
    expect(finishReason).toBe('tool_calls');
    expect(message).toEqual({
      role: 'assistant',
      content: 'Je regarde la chronologie.',
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'fei_timeline', arguments: '{"fei_numero":"ZACH-1"}' },
        },
      ],
    });
  });

  test('réessaie une fois après une coupure réseau, puis renvoie une erreur claire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    await expect(albertChatCompletion({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      'Albert API injoignable : fetch failed'
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
