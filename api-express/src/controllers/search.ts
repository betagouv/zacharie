import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { SearchResponse } from '~/types/responses';
import dayjs from 'dayjs';
import { RequestWithUser } from '~/types/request';
import { UserRoles } from '@prisma/client';

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const searchQuery = req.query.q as string;
    const user = req.user!;

    if (!searchQuery) {
      // console.log('no search query');
      res.status(200).send({ ok: false, data: [], error: '' });
      return;
    }

    if (!user.roles.includes(UserRoles.SVI)) {
      // console.log('user is not svi');
      res.status(200).send({ ok: false, data: [], error: '' });
      return;
    }

    const svi_entity_id = await prisma.entityAndUserRelations
      .findFirst({
        where: {
          owner_id: user.id,
          EntityRelatedWithUser: {
            type: UserRoles.SVI,
          },
        },
      })
      .then((relation) => relation?.entity_id);

    const carcasses = await prisma.carcasse.findMany({
      where: {
        numero_bracelet: searchQuery,
        deleted_at: null,
        intermediaire_carcasse_refus_intermediaire_id: null,
        OR: [
          {
            intermediaire_carcasse_manquante: false,
          },
          {
            intermediaire_carcasse_manquante: null,
          },
        ],
        Fei: {
          svi_entity_id,
          svi_assigned_at: {
            gte: dayjs().subtract(20, 'days').toDate(),
          },
        },
      },
      include: {
        Fei: {
          select: {
            numero: true,
            date_mise_a_mort: true,
            commune_mise_a_mort: true,
            svi_entity_id: true,
            svi_assigned_at: true,
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
          fei_svi_assigned_at: dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY'),
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
            Fei: {
              svi_entity_id,
              svi_assigned_at: {
                gte: dayjs().subtract(20, 'days').toDate(),
              },
            },
          },
          include: {
            Fei: {
              select: {
                numero: true,
                date_mise_a_mort: true,
                commune_mise_a_mort: true,
                svi_entity_id: true,
                svi_assigned_at: true,
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
            fei_svi_assigned_at: dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY'),
            fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
          })),
          error: '',
        } satisfies SearchResponse);
        return;
      }
    }

    const feis = await prisma.fei.findMany({
      where: {
        numero: {
          contains: searchQuery,
        },
        svi_entity_id: svi_entity_id,
        svi_assigned_at: {
          gte: dayjs().subtract(20, 'days').toDate(),
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
          fei_svi_assigned_at: dayjs(fei.svi_assigned_at).format('DD/MM/YYYY'),
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
