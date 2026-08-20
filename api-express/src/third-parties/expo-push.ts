import { capture } from './sentry';
import { IS_DEV_OR_TEST, IS_STAGING, NATIVE_PUSH_DRY_RUN } from '~/config';

// L'app mobile est une WebView Expo : les tokens sont des `ExponentPushToken[…]`,
// envoyés via le service de push d'Expo (qui relaie ensuite vers APNs / FCM).
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo n'accepte pas plus de 100 messages par requête.
const CHUNK_SIZE = 100;

// Expo rejette la requête ENTIÈRE (HTTP 400) si un seul `to` n'a pas ce format : un token malformé
// priverait de notification tous les autres appareils de l'utilisateur.
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;

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
  // Tokens à retirer de la base : format invalide, ou qu'Expo ne connaît plus (app désinstallée,
  // token révoqué). L'appelant les purge.
  tokensToRemove: Array<string>;
};

export async function sendExpoPushNotification({
  tokens,
  title,
  body,
}: SendExpoPushProps): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { sent: 0, tokensToRemove: [] };
  // Comme pour Brevo (third-parties/brevo.ts) : seule la production pousse vers de vrais appareils.
  // La preprod tourne sur une copie des données de prod, ses tokens sont ceux de vrais chasseurs.
  if (IS_STAGING || IS_DEV_OR_TEST) {
    console.log('Native push disabled outside production');
    console.log({ tokens, title, body });
    result.sent = tokens.length;
    return result;
  }
  // `sent` reste à 0 : l'appelant n'écrit alors aucun NotificationLog, donc rien n'est
  // définitivement dédupliqué le temps de la vérification (cf. config.ts).
  if (NATIVE_PUSH_DRY_RUN) {
    console.log('Native push dry run, nothing sent');
    console.log({ tokens, title, body });
    return result;
  }
  const validTokens = tokens.filter((token) => {
    if (EXPO_PUSH_TOKEN_REGEX.test(token)) {
      return true;
    }
    console.log('Invalid expo push token', token);
    result.tokensToRemove.push(token);
    return false;
  });
  for (let index = 0; index < validTokens.length; index += CHUNK_SIZE) {
    const chunk = validTokens.slice(index, index + CHUNK_SIZE);
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
          result.tokensToRemove.push(chunk[ticketIndex]);
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
