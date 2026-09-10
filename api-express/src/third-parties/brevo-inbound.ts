import { BREVO_API } from '~/config';
import { capture } from './sentry';

/**
 * Récupération des pièces jointes des emails entrants (Brevo Inbound Parsing).
 *
 * Le webhook ne transporte pas les fichiers : il envoie un `DownloadToken` par pièce jointe,
 * qu'on échange contre le binaire sur l'API Brevo. Le token n'est valable qu'un temps limité,
 * on télécharge donc à la réception du webhook, pas plus tard.
 */

const BREVO_INBOUND_ATTACHMENT_URL = 'https://api.brevo.com/v3/inbound/attachments';

export async function downloadInboundAttachment(downloadToken: string): Promise<Buffer | null> {
  if (!BREVO_API) {
    capture('Brevo inbound: BREVO_API manquant, pièce jointe non téléchargée');
    return null;
  }
  try {
    const response = await fetch(`${BREVO_INBOUND_ATTACHMENT_URL}/${encodeURIComponent(downloadToken)}`, {
      headers: { 'api-key': BREVO_API, accept: 'application/octet-stream' },
    });
    if (!response.ok) {
      capture('Brevo inbound: téléchargement de pièce jointe en échec', {
        extra: { status: String(response.status), body: (await response.text()).slice(0, 500) },
      });
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    capture(error as Error, { extra: { context: 'download_inbound_attachment' } });
    return null;
  }
}
