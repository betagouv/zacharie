import { describe, test, expect, vi, beforeEach } from 'vitest';

const { update, findUniqueOrThrow, albertChatCompletion } = vi.hoisted(() => ({
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  albertChatCompletion: vi.fn(),
}));

vi.mock('~/prisma', () => ({ default: { bugInvestigation: { update, findUniqueOrThrow } } }));
vi.mock('~/third-parties/albert', () => ({ albertChatCompletion }));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

import {
  checkReadOnlySql,
  describeTables,
  executeInvestigatorTool,
  listSchemaBlocks,
  summarizeHistory,
} from '~/service/bug-investigator/tools';
import { runBugInvestigation } from '~/service/bug-investigator';
import type { BugInvestigationMessage } from '~/types/bug-investigation';

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

describe('describeTables', () => {
  test('renvoie la définition des tables et enums demandés, et signale les noms inconnus', () => {
    const result = describeTables(['Log', 'FeiOwnerRole', 'Inexistante']);
    expect(result).toMatch(/^model Log \{[\s\S]*fei_numero[\s\S]*^\}/m);
    expect(result).toMatch(/^enum FeiOwnerRole \{/m);
    expect(result).toContain('Inexistante : table ou enum inconnu');
    expect(listSchemaBlocks('model')).toContain('Carcasse');
  });
});

describe('summarizeHistory', () => {
  test('ne garde que les champs modifiés, avant → après', () => {
    const history = JSON.stringify({
      before: {
        next_owner_role: 'ETG',
        next_owner_entity_id: 'e1',
        updated_at: 'a',
        current_owner_role: 'ETG',
      },
      after: {
        next_owner_role: null,
        next_owner_entity_id: null,
        updated_at: 'b',
        current_owner_role: 'ETG',
      },
    });
    expect(summarizeHistory(history)).toBe('next_owner_role: ETG → null ; next_owner_entity_id: e1 → null');
  });

  test('résume une création', () => {
    expect(summarizeHistory({ before: null, after: { numero: 'ZACH-1', is_synced: false } })).toBe(
      'création : numero=ZACH-1'
    );
  });
});

describe('runBugInvestigation', () => {
  const firstQuestion: BugInvestigationMessage = {
    role: 'user',
    content: [{ type: 'text', text: 'La fiche ne se transmet pas' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: [structuredClone(firstQuestion)] });
  });

  test("contrôle deux fois un premier rapport rendu sans avoir lu de code, puis l'enregistre", async () => {
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
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'Brouillon 1' }, finishReason: 'stop' })
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'Brouillon 2' }, finishReason: 'stop' })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: '## Résumé\nRAS' },
        finishReason: 'stop',
      });

    await runBugInvestigation('inv-1');

    expect(albertChatCompletion).toHaveBeenCalledTimes(4);
    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'TERMINE',
        live_output: null,
        messages: [
          firstQuestion,
          expect.objectContaining({ role: 'assistant', content: 'Je vérifie la requête.' }),
          { role: 'tool', tool_call_id: 'call-1', content: expect.stringMatching(/^Refusé/) },
          { role: 'assistant', content: 'Brouillon 1', draft: true },
          { role: 'user', content: expect.stringContaining("Tu n'as lu AUCUN fichier"), control: true },
          { role: 'assistant', content: 'Brouillon 2', draft: true },
          { role: 'user', content: expect.stringContaining("Tu n'as lu AUCUN fichier"), control: true },
          { role: 'assistant', content: '## Résumé\nRAS' },
        ],
      },
    });
    // le brouillon et le contrôle sont envoyés à Albert sans les champs internes
    const lastRequest = albertChatCompletion.mock.calls[3][0].messages;
    expect(JSON.stringify(lastRequest)).not.toMatch(/"draft"|"control"/);
  });

  test('contrôle une seule fois un premier rapport quand le code a été lu', async () => {
    const history: Array<BugInvestigationMessage> = [
      firstQuestion,
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call-1', content: 'contenu du fichier' },
    ];
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: structuredClone(history) });
    albertChatCompletion
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'Brouillon' }, finishReason: 'stop' })
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'Rapport' }, finishReason: 'stop' });

    await runBugInvestigation('inv-1');

    const saved = update.mock.lastCall[0].data;
    expect(saved.status).toBe('TERMINE');
    expect(saved.messages.slice(3)).toEqual([
      { role: 'assistant', content: 'Brouillon', draft: true },
      { role: 'user', content: expect.not.stringContaining('AUCUN fichier'), control: true },
      { role: 'assistant', content: 'Rapport' },
    ]);
  });

  test("reprend la conversation et raccourcit les résultats d'outils des tours précédents", async () => {
    const longResult = 'x'.repeat(5000);
    const history: Array<BugInvestigationMessage> = [
      firstQuestion,
      {
        role: 'assistant',
        content: null as string | null,
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
        live_output: null,
        messages: [...history, { role: 'assistant', content: 'Deuxième réponse' }],
      },
    });
  });

  test("enregistre l'erreur si Albert échoue", async () => {
    albertChatCompletion.mockRejectedValueOnce(new Error('Albert API 500'));

    await runBugInvestigation('inv-1');

    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'ERREUR', error: 'Albert API 500', messages: [firstQuestion], live_output: null },
    });
  });

  test('fait décrire les captures par le modèle de vision, puis envoie la transcription au modèle d’enquête', async () => {
    const withImage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Regarde' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xxx' } },
      ],
    };
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: [structuredClone(withImage)] });
    albertChatCompletion
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'Aucune action à effectuer' } })
      .mockResolvedValue({ message: { role: 'assistant', content: 'Réponse' }, finishReason: 'stop' });

    await runBugInvestigation('inv-1');

    expect(albertChatCompletion.mock.calls[0][0].model).toBe('google/gemma-4-31B-it');
    const sentToInvestigator = albertChatCompletion.mock.calls[1][0].messages[1];
    expect(sentToInvestigator.content).toContain('Regarde');
    expect(sentToInvestigator.content).toContain('Aucune action à effectuer');
    expect(JSON.stringify(sentToInvestigator)).not.toContain('data:image');
    const saved = update.mock.lastCall[0].data;
    expect(saved.status).toBe('TERMINE');
    expect(saved.messages[0]).toEqual({ ...withImage, image_descriptions: ['Aucune action à effectuer'] });
  });

  test("garde les résultats complets d'un tour interrompu, sans réponse d'Albert", async () => {
    const longResult = 'x'.repeat(5000);
    const history = [
      firstQuestion,
      {
        role: 'assistant',
        content: null as string | null,
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'fei_timeline', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call-1', content: longResult },
      { role: 'user', content: [{ type: 'text', text: 'Tu en es où ?' }] },
    ];
    findUniqueOrThrow.mockResolvedValue({ id: 'inv-1', messages: structuredClone(history) });
    albertChatCompletion.mockResolvedValueOnce({
      message: { role: 'assistant', content: 'Réponse' },
      finishReason: 'stop',
    });

    await runBugInvestigation('inv-1');

    expect(albertChatCompletion.mock.calls[0][0].messages[3].content).toBe(longResult);
  });

  test('enregistre le texte en cours de streaming, puis le vide à la fin', async () => {
    albertChatCompletion.mockImplementationOnce(async ({ onProgress }) => {
      onProgress({ reasoning: 'Je regarde les logs', content: '' });
      return { message: { role: 'assistant', content: 'Réponse' }, finishReason: 'stop' };
    });

    await runBugInvestigation('inv-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { live_output: 'Je regarde les logs' },
    });
    expect(update.mock.lastCall[0].data.live_output).toBeNull();
  });
});
