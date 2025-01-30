import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';

router.get(
  '/now',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const data = Date.now();
    res.status(200).send({ ok: true, data });
  }),
);

export default router;
