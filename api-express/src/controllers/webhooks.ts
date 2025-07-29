import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import crypto from 'crypto';
import { SENTRY_SECRET, BREVO_BEARER } from '~/config';

router.post(
  '/sentry',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // verify the signature
    console.log({ body: req.body, headers: req.headers });
    const hmac = crypto.createHmac('sha256', SENTRY_SECRET as string);
    hmac.update(JSON.stringify(req.body), 'utf8');
    const digest = hmac.digest('hex');
    console.log({ digest, signature: req.headers['sentry-hook-signature'] });
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
  }),
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
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log('Brevo webhook: Missing Authorization header');
      res.status(401).send({ ok: false, error: 'Unauthorized' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      console.log('Brevo webhook: Malformed Authorization header');
      res.status(401).send({ ok: false, error: 'Unauthorized' });
      return;
    }

    const receivedToken = parts[1];

    if (!BREVO_BEARER) {
      console.error('Brevo webhook: BREVO_BEARER is not configured in the environment.');
      // Potentially send a generic error to the client for security
      res.status(500).send({ ok: false, error: 'Configuration error' });
      return;
    }

    if (receivedToken !== BREVO_BEARER) {
      console.log('Brevo webhook: Invalid token');
      res.status(403).send({ ok: false, error: 'Forbidden' });
      return;
    }

    res.status(200).send({
      ok: true,
      message: 'Webhook received and validated', // More descriptive success message
    });
  }),
);

export default router;
