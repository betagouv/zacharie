import crypto from "crypto";
import { json, ActionFunction } from "@remix-run/node";
import { sendToTchap } from "~/services/sendToTchap";

export const action: ActionFunction = async ({ request }) => {
  try {
    // Log headers for debugging
    const payload = await request.json();
    console.log("payload", payload);
    // Valider et traiter les données de Sentry ici
    if (!payload?.data?.event) {
      return json({ message: "Invalid payload" }, { status: 400 });
    }

    // const secret = import.meta.env.VITE_SENTRY_HOOK_SECRET;
    // const hmac = crypto.createHmac("sha256", secret);
    // hmac.update(JSON.stringify(request.body), "utf8");
    // const digest = hmac.digest("hex");
    // if (digest !== request.headers.get("sentry-hook-signature")) {
    //   return json({ message: "Invalid signature" }, { status: 400 });
    // }

    const eventData = payload.data.event;
    // Format message
    const message = `Nouvelle alerte Sentry: ${eventData.title}\n\nDétails: ${eventData.message}`;

    // Envoyer l'événement à Tchap
    await sendToTchap(message);

    return json({ message: "Event processed" });
  } catch (error) {
    console.error("Error processing Sentry event:", error);
    return json({ message: "Error processing Sentry event" }, { status: 500 });
  }
};

export default function WebhookSentry() {
  return <div>WebhookSentry</div>;
}