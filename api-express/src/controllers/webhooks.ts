import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import crypto from 'crypto';
import { SENTRY_SECRET, BREVO_BEARER } from '~/config';
import { capture } from '~/third-parties/sentry';
import { ingestInboundEmails, inboundEmailPayloadSchema } from '~/utils/trichine-inbound-email';

/** Auth des webhooks Brevo : Bearer posé à la création du webhook (cf curl ci-dessous). */
function brevoBearerIsValid(req: express.Request, res: express.Response): boolean {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log('Brevo webhook: Missing Authorization header');
    res.status(401).send({ ok: false, error: 'Unauthorized' });
    return false;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    console.log('Brevo webhook: Malformed Authorization header');
    res.status(401).send({ ok: false, error: 'Unauthorized' });
    return false;
  }

  if (!BREVO_BEARER) {
    console.error('Brevo webhook: BREVO_BEARER is not configured in the environment.');
    res.status(500).send({ ok: false, error: 'Configuration error' });
    return false;
  }

  if (parts[1] !== BREVO_BEARER) {
    console.log('Brevo webhook: Invalid token');
    res.status(403).send({ ok: false, error: 'Forbidden' });
    return false;
  }

  return true;
}

router.post(
  '/sentry',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // verify the signature
    const hmac = crypto.createHmac('sha256', SENTRY_SECRET as string);
    hmac.update(JSON.stringify(req.body), 'utf8');
    const digest = hmac.digest('hex');
    if (digest !== req.headers['sentry-hook-signature']) {
      // wrong signature, do nothing
      res.status(200).send({
        ok: true,
        error: '',
      });
      return;
    }

    res.status(200).send({
      ok: true,
      error: '',
    });
  })
);

/* 
To create the webhook with Bearer Auth, you can use the following curl command:

curl --request POST \
  --url https://api.brevo.com/v3/webhooks \
  --header 'accept: application/json' \
  --header 'api-key: YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --data '{
    "url": "https://api.zacharie.beta.gouv.fr/webhooks/brevo",
    "description": "My application webhook for Brevo contact updates with Bearer Auth",
    "events": ["contactUpdated", "contactDeleted"], // beware of camelCase, it's not properly documented
    "type": "marketing",
    "channel": "email",
    "auth": {
      "type": "bearer",
      "token": "YOUR_BEARER_TOKEN"
    }
  }'
*/
router.post(
  '/brevo',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!brevoBearerIsValid(req, res)) return;

    res.status(200).send({
      ok: true,
      message: 'Webhook received and validated', // More descriptive success message
    });
  })
);

/*
Webhook des emails entrants (Brevo Inbound Parsing) : les laboratoires renvoient leur rapport
COFRAC à l'adresse de dépôt (TRICHINE_RESULTATS_EMAIL), on stocke la pièce jointe et on la
rattache au pool dont la référence figure dans le message (cf utils/trichine-inbound-email.ts).
*/
router.post(
  '/brevo-inbound',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!brevoBearerIsValid(req, res)) return;

    const payload = inboundEmailPayloadSchema.safeParse(req.body);
    if (!payload.success) {
      // 200 quand même : Brevo rejoue tant qu'il n'a pas de 2xx, et un payload illisible le restera
      capture('Brevo inbound: payload inattendu', {
        extra: { body: JSON.stringify(req.body).slice(0, 2000) },
      });
      res.status(200).send({ ok: false, error: 'Payload inattendu' });
      return;
    }

    const results = await ingestInboundEmails(payload.data.items);

    res.status(200).send({ ok: true, data: { results }, error: '' });
  })
);

export default router;
