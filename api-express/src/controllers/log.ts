import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { LogResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma } from '@prisma/client';

router.post(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Fetch the fiche data along with the required intervenants
    const body = req.body as Prisma.LogUncheckedCreateInput;
    if (!body.id) {
      res.status(400).send({
        ok: false,
        data: { log: null },
        error: 'Missing log id',
      } satisfies LogResponse);
      return;
    }

    const log = await prisma.log.create({
      data: {
        id: body.id,
        user_id: body.user_id,
        user_role: body.user_role,
        fei_numero: body.fei_numero,
        entity_id: body.entity_id,
        zacharie_carcasse_id: body.zacharie_carcasse_id,
        fei_intermediaire_id: body.fei_intermediaire_id,
        carcasse_intermediaire_id: body.carcasse_intermediaire_id,
        action: body.action,
        history: body.history,
        date: body.date,
        is_synced: true,
      },
    });

    res.status(200).send({
      ok: true,
      data: { log },
      error: '',
    } satisfies LogResponse);
  }),
);

export default router;
