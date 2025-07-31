import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { EntityRelationType, Prisma, UserRoles } from '@prisma/client';

router.get(
  '/:zacharie_carcasse_id',
  passport.authenticate('apiKeyLog', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero,
      },
      include: {
        Carcasses: {
          include: {
            CarcasseIntermediaire: true,
          },
        },
        FeiExaminateurInitialUser: true,
        FeiPremierDetenteurUser: true,
        FeiPremierDetenteurEntity: true,
        FeiDepotEntity: true,
        FeiCurrentUser: true,
        FeiCurrentEntity: true,
        FeiNextUser: true,
        FeiNextEntity: true,
        FeiSviUser: true,
        FeiSviEntity: true,
        CarcasseIntermediaire: {
          include: {
            CarcasseIntermediaireEntity: true,
            CarcasseIntermediaireUser: true,
          },
          orderBy: [{ prise_en_charge_at: Prisma.SortOrder.asc }, { created_at: Prisma.SortOrder.desc }],
        },
      },
    });

    if (!fei) {
      res.status(404).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: {
        fei,
      },
      error: '',
    } satisfies FeiResponse);
  }),
);

export default router;
