import { describe, test, expect, vi, beforeEach } from 'vitest';
import { sendExpoPushNotification } from '~/third-parties/expo-push';

// Hors production l'envoi est court-circuité : on force les deux drapeaux à false pour tester le
// vrai chemin. SENTRY_KEY est lu par third-parties/sentry.ts.
vi.mock('~/config', () => ({ IS_DEV_OR_TEST: false, IS_STAGING: false, SENTRY_KEY: '' }));

const notification = { title: 'Un titre', body: 'Un corps' };

function mockExpoResponse(tickets: Array<unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: tickets }) }));
}

describe('sendExpoPushNotification', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Expo rejette la requête entière si un seul `to` est malformé : les tokens invalides ne doivent
  // jamais partir, et il faut les purger sinon ils cassent le push de l'utilisateur pour toujours.
  test('n’envoie pas les tokens au mauvais format et les remonte à purger', async () => {
    mockExpoResponse([{ status: 'ok', id: '1' }]);

    const result = await sendExpoPushNotification({
      tokens: ['{"type":"expo","data":"ExponentPushToken[abc]"}', 'ExponentPushToken[abc]'],
      ...notification,
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(options!.body as string)).toEqual([
      expect.objectContaining({ to: 'ExponentPushToken[abc]' }),
    ]);
    expect(result.sent).toBe(1);
    expect(result.tokensToRemove).toEqual(['{"type":"expo","data":"ExponentPushToken[abc]"}']);
  });

  test('n’appelle pas Expo quand aucun token n’est valide', async () => {
    mockExpoResponse([]);

    const result = await sendExpoPushNotification({ tokens: ['n’importe quoi'], ...notification });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.tokensToRemove).toEqual(['n’importe quoi']);
  });

  test('remonte les tokens DeviceNotRegistered à purger', async () => {
    mockExpoResponse([
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: '2' },
    ]);

    const result = await sendExpoPushNotification({
      tokens: ['ExponentPushToken[abc]', 'ExponentPushToken[def]'],
      ...notification,
    });

    expect(result.sent).toBe(1);
    expect(result.tokensToRemove).toEqual(['ExponentPushToken[abc]']);
  });

  test('accepte le format legacy ExpoPushToken', async () => {
    mockExpoResponse([{ status: 'ok', id: '1' }]);

    const result = await sendExpoPushNotification({ tokens: ['ExpoPushToken[abc]'], ...notification });

    expect(fetch).toHaveBeenCalled();
    expect(result.tokensToRemove).toEqual([]);
  });
});
