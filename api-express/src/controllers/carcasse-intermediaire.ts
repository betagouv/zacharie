import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcasseIntermediaireResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';

router.get(
  '/:fei_numero/:intermediaire_id/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<CarcasseIntermediaireResponse>,
      next: express.NextFunction
    ) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
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
      if (!req.params.zacharie_carcasse_id) {
        res.status(400).send({ ok: false, data: null, error: 'Missing zacharie_carcasse_id' });
        return;
      }
      const carcasseIntermediaire = await prisma.carcasseIntermediaire.findUnique({
        where: {
          fei_numero_zacharie_carcasse_id_intermediaire_id: {
            fei_numero: req.params.fei_numero,
            zacharie_carcasse_id: req.params.zacharie_carcasse_id,
            intermediaire_id: req.params.intermediaire_id,
          },
        },
      });
      if (!carcasseIntermediaire) {
        res.status(400).send({
          ok: false,
          data: null,
          error: 'Missing caracsse intermediaire',
        });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasseIntermediaire },
        error: '',
      });
    }
  )
);

export default router;
