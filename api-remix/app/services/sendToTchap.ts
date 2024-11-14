import * as sdk from "matrix-js-sdk";

const homeserverUrl = "https://matrix.agent.dinum.tchap.gouv.fr";
const roomId = import.meta.env.VITE_TCHAP_SENTRY_ROOM_ID as string;
const username = import.meta.env.VITE_TCHAP_SENTRY_USERNAME as string;
const password = import.meta.env.VITE_TCHAP_SENTRY_PASSWORD as string;

export async function sendToTchap(message: string) {
  const client = sdk.createClient({
    baseUrl: homeserverUrl,
  });

  try {
    // Login
    await client.login("m.login.password", {
      user: username,
      password: password,
    });

    // Send message
    await client.sendMessage(roomId, {
      msgtype: sdk.MsgType.Text,
      body: message,
    });

    // Cleanup
    client.stopClient();
  } catch (error) {
    console.error("Erreur d'envoi vers Tchap:", error);
    throw error;
  }
}
