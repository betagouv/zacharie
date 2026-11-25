import { capture } from './sentry';
import { IS_DEV_OR_TEST, IS_STAGING, NATIVE_PUSH_DRY_RUN } from '~/config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const CHUNK_SIZE = 100;

const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

type SendExpoPushProps = {
  tokens: Array<string>;
  title: string;
  body: string;
  url?: string;
};

type ExpoPushResult = {
  sent: number;
  tokensToRemove: Array<string>;
};

export async function sendExpoPushNotification({
  tokens,
  title,
  body,
  url,
}: SendExpoPushProps): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { sent: 0, tokensToRemove: [] };
  if (IS_STAGING || IS_DEV_OR_TEST) {
    console.log('Native push disabled outside production');
    console.log({ tokensCount: tokens.length, title, body });
    result.sent = tokens.length;
    return result;
  }
  if (NATIVE_PUSH_DRY_RUN) {
    console.log('Native push dry run, nothing sent');
    console.log({ tokensCount: tokens.length, title, body });
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
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title,
            body,
            sound: 'default',
            priority: 'high',
            ...(url ? { data: { url } } : {}),
          }))
        ),
      });
      if (!response.ok) {
        throw new Error(`Expo push API ${response.status}: ${await response.text()}`);
      }
      const payload = (await response.json()) as { data?: Array<ExpoPushTicket> };
      if (!Array.isArray(payload?.data)) {
        throw new Error(`Expo push API: réponse inattendue ${JSON.stringify(payload)}`);
      }
      const { data } = payload;
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
      capture(error as Error, { extra: { chunkSize: chunk.length, title, body } });
    }
  }
  return result;
}
