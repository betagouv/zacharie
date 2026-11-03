import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';

const router: express.Router = express.Router();

// lu par le serveur de l'app (server-app.js) quand Zacharie est chargé dans une iframe :
// origines autorisées par l'en-tête CSP frame-ancestors, réglées par clé API dans l'admin
router.get(
  '/',
  catchErrors(async (_req: express.Request, res: express.Response) => {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        active: true,
        deleted_at: null,
        frame_ancestors: { isEmpty: false },
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      select: { frame_ancestors: true },
    });
    const origins = [...new Set(apiKeys.flatMap((apiKey) => apiKey.frame_ancestors))];
    res.status(200).send({ ok: true, data: { origins }, error: '' });
  })
);

export default router;
