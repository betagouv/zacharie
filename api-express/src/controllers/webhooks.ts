import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import crypto from 'crypto';
import { SENTRY_SECRET, BREVO_BEARER } from '~/config';
import { capture } from '~/third-parties/sentry';

function memeSecret(recu: string, attendu: string): boolean {
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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

  if (!memeSecret(parts[1], BREVO_BEARER)) {
    capture('Brevo webhook: token invalide', {
      extra: { path: req.path, ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' },
    });
    res.status(403).send({ ok: false, error: 'Forbidden' });
    return false;
  }

  return true;
}

router.post(
  '/sentry',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const hmac = crypto.createHmac('sha256', SENTRY_SECRET as string);
    hmac.update(JSON.stringify(req.body), 'utf8');
    const digest = hmac.digest('hex');
    if (digest !== req.headers['sentry-hook-signature']) {
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

router.post(
  '/brevo',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!brevoBearerIsValid(req, res)) return;

    res.status(200).send({
      ok: true,
      message: 'Webhook received and validated',
    });
  })
);

export default router;
