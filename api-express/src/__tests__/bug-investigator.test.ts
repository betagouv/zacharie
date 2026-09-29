import { describe, test, expect, vi, beforeEach } from 'vitest';

const { update, findUniqueOrThrow, albertChatCompletion } = vi.hoisted(() => ({
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  albertChatCompletion: vi.fn(),
}));

vi.mock('~/prisma', () => ({ default: { bugInvestigation: { update, findUniqueOrThrow } } }));
vi.mock('~/third-parties/albert', () => ({ albertChatCompletion }));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

import { checkReadOnlySql, executeInvestigatorTool } from '~/service/bug-investigator/tools';
import { runBugInvestigation } from '~/service/bug-investigator';

describe('checkReadOnlySql', () => {
  test('accepte un SELECT ou un WITH, avec ou sans point-virgule final', () => {
    expect(checkReadOnlySql('SELECT * FROM "Fei";')).toEqual({ sql: 'SELECT * FROM "Fei"', error: null });
    expect(checkReadOnlySql('  with x as (select 1) select * from x').error).toBeNull();
  });

  test('refuse les écritures et les requêtes multiples', () => {
    expect(checkReadOnlySql('DELETE FROM "Fei"').error).not.toBeNull();
    expect(checkReadOnlySql('UPDATE "User" SET "nom_de_famille" = \'x\'').error).not.toBeNull();
    expect(checkReadOnlySql('SELECT 1; DROP TABLE "Fei"').error).not.toBeNull();
    expect(checkReadOnlySql('').error).not.toBeNull();
  });

  test("l'outil query_db refuse une écriture sans toucher à la base", async () => {
    expect(await executeInvestigatorTool('query_db', JSON.stringify({ sql: 'DELETE FROM "Fei"' }))).toMatch(
      /^Refusé/
    );
  });
});

describe('runBugInvestigation', () => {
  const firstQuestion = { role: 'user', content: [{ type: 'text', text: 'La fiche ne se transmet pas' }] };

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: [structuredClone(firstQuestion)] });
  });

  test('exécute les outils demandés puis enregistre la réponse dans la conversation', async () => {
    albertChatCompletion
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: 'Je vérifie la requête.',
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'query_db', arguments: JSON.stringify({ sql: 'DROP TABLE "Fei"' }) },
            },
          ],
        },
        finishReason: 'tool_calls',
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: '## Résumé\nRAS' },
        finishReason: 'stop',
      });

    await runBugInvestigation('inv-1');

    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'TERMINE',
        messages: [
          firstQuestion,
          expect.objectContaining({ role: 'assistant', content: 'Je vérifie la requête.' }),
          { role: 'tool', tool_call_id: 'call-1', content: expect.stringMatching(/^Refusé/) },
          { role: 'assistant', content: '## Résumé\nRAS' },
        ],
      },
    });
  });

  test("reprend la conversation et raccourcit les résultats d'outils des tours précédents", async () => {
    const longResult = 'x'.repeat(5000);
    const history = [
      firstQuestion,
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'query_db', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call-1', content: longResult },
      { role: 'assistant', content: 'Premier rapport' },
      { role: 'user', content: [{ type: 'text', text: "Non, c'est faux" }] },
    ];
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: structuredClone(history) });
    albertChatCompletion.mockResolvedValueOnce({
      message: { role: 'assistant', content: 'Deuxième réponse' },
      finishReason: 'stop',
    });

    await runBugInvestigation('inv-1');

    const sent = albertChatCompletion.mock.calls[0][0].messages;
    expect(sent[0].role).toBe('system');
    expect(sent.slice(1).map((m: { role: string }) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
      'user',
    ]);
    expect(sent[3].content.length).toBeLessThan(longResult.length);
    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'TERMINE',
        messages: [...history, { role: 'assistant', content: 'Deuxième réponse' }],
      },
    });
  });

  test("enregistre l'erreur si Albert échoue", async () => {
    albertChatCompletion.mockRejectedValueOnce(new Error('Albert API 500'));

    await runBugInvestigation('inv-1');

    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'ERREUR', error: 'Albert API 500', messages: [firstQuestion] },
    });
  });
});
