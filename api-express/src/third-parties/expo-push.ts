import { capture } from './sentry';

// L'app mobile est une WebView Expo : les tokens sont des `ExponentPushToken[…]`,
// envoyés via le service de push d'Expo (qui relaie ensuite vers APNs / FCM).
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo n'accepte pas plus de 100 messages par requête.
const CHUNK_SIZE = 100;

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

type SendExpoPushProps = {
  tokens: Array<string>;
  title: string;
  body: string;
};

type ExpoPushResult = {
  sent: number;
  // Tokens qu'Expo ne connaît plus (app désinstallée, token révoqué) : l'appelant les purge.
  unregisteredTokens: Array<string>;
};

export async function sendExpoPushNotification({
  tokens,
  title,
  body,
}: SendExpoPushProps): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { sent: 0, unregisteredTokens: [] };
  for (let index = 0; index < tokens.length; index += CHUNK_SIZE) {
    const chunk = tokens.slice(index, index + CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(chunk.map((to) => ({ to, title, body, sound: 'default', priority: 'high' }))),
      });
      if (!response.ok) {
        throw new Error(`Expo push API ${response.status}: ${await response.text()}`);
      }
      // Expo peut répondre 200 sans `data` (ex. `{ "errors": [...] }`) : sans ce garde-fou on
      // perdrait sa réponse au profit d'un TypeError opaque.
      const payload = (await response.json()) as { data?: Array<ExpoPushTicket> };
      if (!Array.isArray(payload?.data)) {
        throw new Error(`Expo push API: réponse inattendue ${JSON.stringify(payload)}`);
      }
      const { data } = payload;
      // Expo renvoie un ticket par message, dans l'ordre d'envoi.
      data.forEach((ticket, ticketIndex) => {
        if (ticket.status === 'ok') {
          result.sent++;
          return;
        }
        if (ticket.details?.error === 'DeviceNotRegistered') {
          result.unregisteredTokens.push(chunk[ticketIndex]);
          return;
        }
        capture(new Error(`Expo push ticket error: ${ticket.message}`), {
          extra: { token: chunk[ticketIndex], title, body, ticket },
        });
      });
    } catch (error) {
      capture(error as Error, { extra: { chunk, title, body } });
    }
  }
  return result;
}
