import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router = express.Router();
import prisma from '~/prisma';
import type { SearchResponse } from '~/types/responses';

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const searchQuery = req.query.q as string;

      if (!searchQuery) {
        res.status(200).send({ ok: false, data: null, error: '' });
        return;
      }

      const carcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: searchQuery,
        },
      });

      if (carcasse) {
        res.status(200).send({
          ok: true,
          data: {
            searchQuery,
            redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.numero_bracelet}`,
            carcasse_numero_bracelet: carcasse.numero_bracelet,
            fei_numero: '',
          },
          error: '',
        } satisfies SearchResponse);
        return;
      }

      const carcasseIntermediaireCommentaire =
        await prisma.carcasseIntermediaire.findFirst({
          where: {
            commentaire: {
              contains: searchQuery,
            },
          },
        });

      if (carcasseIntermediaireCommentaire) {
        const carcasse = await prisma.carcasse.findFirst({
          where: {
            numero_bracelet: carcasseIntermediaireCommentaire.numero_bracelet,
          },
        });
        if (carcasse) {
          res.status(200).send({
            ok: true,
            data: {
              searchQuery,
              redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.numero_bracelet}`,
              carcasse_numero_bracelet: carcasse.numero_bracelet,
              fei_numero: '',
            },
            error: '',
          } satisfies SearchResponse);
          return;
        }
      }

      const fei = await prisma.fei.findFirst({
        where: {
          numero: searchQuery,
        },
      });

      if (fei) {
        res.status(200).send({
          ok: true,
          data: {
            searchQuery,
            redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
            fei_numero: fei.numero,
            carcasse_numero_bracelet: '',
          },
          error: '',
        } satisfies SearchResponse);
        return;
      }

      res.status(200).send({
        ok: true,
        data: {
          searchQuery,
          redirectUrl: '',
          fei_numero: '',
          carcasse_numero_bracelet: '',
        },
        error: 'Aucun élément ne correspond à votre recherche',
      } satisfies SearchResponse);
    },
  ),
);

export default router;
