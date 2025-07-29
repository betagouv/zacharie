import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';

router.get(
  '/nombre-de-carcasses-cumule',
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    res.status(200).send({
      ok: true,
      data: {
        carcassesCumuleUrl: getIframeUrl(88),
        especesUrl: getIframeUrl(43),
        saisiesUrl: getIframeUrl(37),
      },
    });
  }),
);

export default router;
