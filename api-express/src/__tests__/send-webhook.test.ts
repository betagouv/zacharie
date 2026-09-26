import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ApiKeyApprovalStatus } from '@prisma/client';
import prisma from '~/prisma';
import { sendWebhook } from '~/utils/api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(prisma.apiKeyLog.create).mockResolvedValue({} as any);
});

const approval = {
  status: ApiKeyApprovalStatus.APPROVED,
  ApiKey: { id: 'key-1', webhook_url: 'https://partenaire.example.fr/webhook', private_key: 'secret' },
};

describe('sendWebhook', () => {
  test('does nothing without a user id, instead of matching every entity approval', async () => {
    await sendWebhook(null, 'CARCASSE_ASSIGNEE_AU_SVI', { carcasseZacharieId: 'ZACH-1_BR-A' });

    expect(prisma.apiKeyApprovalByUserOrEntity.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sends the v1 API shape, without the raw user rows', async () => {
    vi.mocked(prisma.apiKeyApprovalByUserOrEntity.findMany).mockResolvedValueOnce([approval] as any);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce({
      numero_bracelet: 'BR-A',
      fei_numero: 'ZACH-1',
    } as any);
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce({
      numero: 'ZACH-1',
      FeiExaminateurInitialUser: { prenom: 'Jean', nom_de_famille: 'Dupont' },
      FeiPremierDetenteurUser: null,
      FeiPremierDetenteurEntity: { raison_sociale: 'Chasse du Bois' },
    } as any);

    await sendWebhook('exam-1', 'CARCASSE_ASSIGNEE_AU_SVI', { carcasseZacharieId: 'ZACH-1_BR-A' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.event).toBe('CARCASSE_ASSIGNEE_AU_SVI');
    expect(payload.fei).toBeNull();
    expect(payload.carcasses).toHaveLength(1);
    expect(payload.carcasses[0]).toMatchObject({
      numero_bracelet: 'BR-A',
      examinateur_name: 'Jean Dupont',
      premier_detenteur_name: 'Chasse du Bois',
    });
    expect(payload.carcasses[0]).not.toHaveProperty('FeiExaminateurInitialUser');
    await vi.waitFor(() => expect(prisma.apiKeyLog.create).toHaveBeenCalledOnce());
  });
});
