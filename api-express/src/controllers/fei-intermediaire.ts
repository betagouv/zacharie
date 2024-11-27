import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { FeiIntermediaireResponse } from '~/types/responses';
const router = express.Router();
import prisma from '~/prisma';
import { Prisma } from '@prisma/client';

router.post(
  '/:fei_numero/:intermediaire_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Fetch the fiche data along with the required intervenants
    const body = req.body;
    const { fei_numero, intermediaire_id } = req.params;
    if (!fei_numero) {
      res.status(400).send({
        ok: false,
        data: { feiIntermediaire: null },
        error: 'Le numéro de fiche est obligatoire',
      } satisfies FeiIntermediaireResponse);
      return;
    }
    const existingFei = await prisma.fei.findUnique({
      where: { numero: fei_numero },
    });
    if (!existingFei) {
      res.status(400).send({
        ok: false,
        data: { feiIntermediaire: null },
        error: 'Fiche non trouvée',
      } satisfies FeiIntermediaireResponse);
      return;
    }
    if (!intermediaire_id) {
      res.status(400).send({
        ok: false,
        data: { feiIntermediaire: null },
        error: "L'identifiant du destinataire est obligatoire",
      } satisfies FeiIntermediaireResponse);
      return;
    }

    let existingIntermediaire = await prisma.feiIntermediaire.findUnique({
      where: { id: intermediaire_id },
    });

    if (!existingIntermediaire) {
      existingIntermediaire = await prisma.feiIntermediaire.create({
        data: {
          id: intermediaire_id, // {user_id}_{fei_numero}_{HHMMSS}
          fei_numero,
          fei_intermediaire_user_id: body[Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_user_id],
          fei_intermediaire_entity_id:
            body[Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_entity_id],
          fei_intermediaire_role: body[Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_role],
          fei_intermediaire_offline:
            body[Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_offline] === 'true' ? true : false,
          is_synced: true,
        },
      });
    }

    const nextFeiIntermediaire: Prisma.FeiIntermediaireUncheckedUpdateInput = {
      is_synced: true,
    };

    if (body[Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at]) {
      nextFeiIntermediaire.check_finished_at = body.check_finished_at;
    }

    existingIntermediaire = await prisma.feiIntermediaire.update({
      where: {
        id: intermediaire_id,
      },
      data: nextFeiIntermediaire,
    });

    res.status(200).send({
      ok: true,
      data: { feiIntermediaire: existingIntermediaire },
      error: '',
    } satisfies FeiIntermediaireResponse);
  }),
);

router.get(
  '/:fei_numero/:intermediaire_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
      },
    });
    if (!fei) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }
    if (!req.params.intermediaire_id) {
      res.status(400).send({ ok: false, data: null, error: 'Missing intermediaire_id' });
      return;
    }
    const intermediaire = await prisma.feiIntermediaire.findUnique({
      where: {
        id: req.params.intermediaire_id,
      },
    });
    if (!intermediaire) {
      res.status(400).send({
        ok: false,
        data: null,
        error: 'Missing fei intermediaire',
      });
      return;
    }

    res.status(200).send({
      ok: true,
      data: { feiIntermediaire: intermediaire },
      error: '',
    });
  }),
);

router.get(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
      },
    });
    if (!fei) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const intermediaires = await prisma.feiIntermediaire.findMany({
      where: {
        fei_numero: req.params.fei_numero,
      },
      orderBy: {
        created_at: 'desc', // the latest first
      },
    });

    res.status(200).send({
      ok: true,
      data: { feiIntermediaires: intermediaires },
      error: '',
    });
  }),
);

export default router;
