import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { SearchResponse } from '~/types/responses';
import dayjs from 'dayjs';

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const searchQuery = req.query.q as string;

    console.log({ searchQuery });
    if (!searchQuery) {
      res.status(200).send({ ok: false, data: [], error: '' });
      return;
    }

    const carcasses = await prisma.carcasse.findMany({
      where: {
        numero_bracelet: searchQuery,
      },
      include: {
        Fei: {
          select: {
            numero: true,
            date_mise_a_mort: true,
            commune_mise_a_mort: true,
          },
        },
      },
    });

    if (carcasses?.length) {
      res.status(200).send({
        ok: true,
        data: carcasses.map((carcasse) => ({
          searchQuery,
          redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
          carcasse_numero_bracelet: carcasse.numero_bracelet,
          carcasse_espece: carcasse.espece || '',
          carcasse_type: carcasse.type,
          fei_numero: carcasse.fei_numero,
          fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
          fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
        })),
        error: '',
      } satisfies SearchResponse);
      return;
    }

    const carcasseIntermediaires = await prisma.carcasseIntermediaire.findMany({
      where: {
        commentaire: {
          contains: searchQuery,
        },
      },
    });

    if (carcasseIntermediaires.length) {
      const carcasses = [];
      for (const carcasseIntermediaire of carcasseIntermediaires) {
        const carcassesFound = await prisma.carcasse.findMany({
          where: {
            numero_bracelet: carcasseIntermediaire.numero_bracelet,
          },
          include: {
            Fei: {
              select: {
                numero: true,
                date_mise_a_mort: true,
                commune_mise_a_mort: true,
              },
            },
          },
        });
        if (carcassesFound) {
          carcasses.push(...carcassesFound);
        }
      }
      if (carcasses.length) {
        res.status(200).send({
          ok: true,
          data: carcasses.map((carcasse) => ({
            searchQuery,
            redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
            carcasse_numero_bracelet: carcasse.numero_bracelet,
            carcasse_espece: carcasse.espece || '',
            carcasse_type: carcasse.type,
            fei_numero: carcasse.fei_numero,
            fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
            fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
          })),
          error: '',
        } satisfies SearchResponse);
        return;
      }
    }

    console.log({ searchQuery });
    const feis = await prisma.fei.findMany({
      where: {
        numero: {
          contains: searchQuery,
        },
      },
    });

    if (feis.length) {
      res.status(200).send({
        ok: true,
        data: feis.map((fei) => ({
          searchQuery,
          redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
          carcasse_numero_bracelet: '',
          carcasse_espece: '',
          carcasse_type: '',
          fei_numero: fei.numero,
          fei_date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
          fei_commune_mise_a_mort: fei.commune_mise_a_mort!,
        })),
        error: '',
      } satisfies SearchResponse);
      return;
    }

    res.status(200).send({
      ok: true,
      data: [],
      error: 'Aucun élément ne correspond à votre recherche',
    } satisfies SearchResponse);
  }),
);

export default router;
