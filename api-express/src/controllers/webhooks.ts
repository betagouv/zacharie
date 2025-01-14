import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router: express.Router = express.Router();
import crypto from 'crypto';
import { SENTRY_SECRET } from '~/config';

router.post(
  '/sentry',
  passport.authenticate('user', { session: false }),
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

export default router;
