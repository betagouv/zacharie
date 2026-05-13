import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { AdminOfficialCfeisResponse } from '~/types/responses';

router.get(
  '/official-cfeis',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminOfficialCfeisResponse>,
      next: express.NextFunction
    ) => {
      const officialCfeis = await prisma.officialCfei.findMany({
        select: {
          numero_cfei: true,
          nom: true,
          prenom: true,
          departement: true,
        },
      });
      res.status(200).send({ ok: true, data: { officialCfeis }, error: '' });
    }
  )
);

export default router;
