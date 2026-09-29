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
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueOrThrow.mockResolvedValue({
      id: 'inv-1',
      description: 'La fiche ne se transmet pas',
      images: [],
    });
  });

  test('exécute les outils demandés puis enregistre le rapport final', async () => {
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

    const messages = albertChatCompletion.mock.calls[1][0].messages;
    expect(messages.find((m: { role: string }) => m.role === 'tool')).toEqual({
      role: 'tool',
      tool_call_id: 'call-1',
      content: expect.stringMatching(/^Refusé/),
    });
    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'TERMINE',
        report: '## Résumé\nRAS',
        steps: [
          expect.objectContaining({ type: 'message', content: 'Je vérifie la requête.' }),
          expect.objectContaining({ type: 'tool', tool: 'query_db' }),
        ],
      },
    });
  });

  test("enregistre l'erreur si Albert échoue", async () => {
    albertChatCompletion.mockRejectedValueOnce(new Error('Albert API 500'));

    await runBugInvestigation('inv-1');

    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'ERREUR', error: 'Albert API 500', steps: [] },
    });
  });
});
