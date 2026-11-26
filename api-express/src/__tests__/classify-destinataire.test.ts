import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EntityTypes } from '@prisma/client';

vi.mock('~/config', () => ({ ALBERT_API_KEY: 'test-key' }));
vi.mock('~/third-parties/albert', () => ({ albertChatCompletion: vi.fn() }));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

import { albertChatCompletion } from '~/third-parties/albert';
import { classifyDestinataire, parseClassification } from '~/utils/classify-destinataire';

describe('parseClassification', () => {
  test.each([
    ['COMMERCE_DE_DETAIL', EntityTypes.COMMERCE_DE_DETAIL],
    ['  cantine_ou_restauration_collective\n', EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE],
    ['`ASSOCIATION_CARITATIVE`.', EntityTypes.ASSOCIATION_CARITATIVE],
    ['**REPAS_DE_CHASSE_OU_ASSOCIATIF**', EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF],
    ['COLLECTEUR_PRO', EntityTypes.COLLECTEUR_PRO],
    ['CIRCUIT_COURT', EntityTypes.CIRCUIT_COURT],
  ])('%j → %s', (content, expected) => {
    expect(parseClassification(content)).toBe(expected);
  });

  test.each([['ETG'], ['CONSOMMATEUR_FINAL'], ['Je pense que c’est COMMERCE_DE_DETAIL'], [''], [null]])(
    'réponse hors liste (%j) → CIRCUIT_COURT',
    (content) => {
      expect(parseClassification(content)).toBe(EntityTypes.CIRCUIT_COURT);
    }
  );
});

describe('classifyDestinataire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('envoie la raison sociale et la qualité saisie à Albert', async () => {
    vi.mocked(albertChatCompletion).mockResolvedValueOnce({
      message: { role: 'assistant', content: 'COMMERCE_DE_DETAIL' },
      finishReason: 'stop',
    });

    const type = await classifyDestinataire({
      raisonSociale: 'Boucherie Martin',
      qualiteDuDestinataire: 'boucherie',
    });

    expect(type).toBe(EntityTypes.COMMERCE_DE_DETAIL);
    const { messages } = vi.mocked(albertChatCompletion).mock.calls[0][0];
    expect(messages[1].content).toContain('Boucherie Martin');
    expect(messages[1].content).toContain('boucherie');
  });

  test('Albert en erreur → CIRCUIT_COURT', async () => {
    vi.mocked(albertChatCompletion).mockRejectedValueOnce(new Error('Albert API 500'));

    const type = await classifyDestinataire({ raisonSociale: 'X', qualiteDuDestinataire: 'y' });

    expect(type).toBe(EntityTypes.CIRCUIT_COURT);
  });
});
