import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type {
  AdminCarcassesIntermediairesResponse,
  AdminCarcassesResponse,
  AdminCarcasseDetailResponse,
} from '~/types/responses';

router.get(
  '/carcasses',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcassesResponse>,
      next: express.NextFunction
    ) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';

      const where = search
        ? {
            OR: [
              { numero_bracelet: { contains: search, mode: 'insensitive' as const } },
              { fei_numero: { contains: search, mode: 'insensitive' as const } },
              { espece: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [carcasses, total] = await Promise.all([
        prisma.carcasse.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            _count: { select: { CarcasseIntermediaire: true } },
          },
        }),
        prisma.carcasse.count({ where }),
      ]);

      res.status(200).send({ ok: true, data: { carcasses, total }, error: '' });
    }
  )
);

router.get(
  '/carcasses-intermediaires',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcassesIntermediairesResponse>,
      next: express.NextFunction
    ) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const [carcassesIntermediaires, total] = await Promise.all([
        prisma.carcasseIntermediaire.findMany({
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            CarcasseIntermediaireEntity: { select: { nom_d_usage: true, type: true } },
            CarcasseIntermediaireUser: { select: { email: true } },
            CarcasseCarcasseIntermediaire: { select: { numero_bracelet: true, espece: true } },
          },
        }),
        prisma.carcasseIntermediaire.count(),
      ]);

      res.status(200).send({ ok: true, data: { carcassesIntermediaires, total }, error: '' });
    }
  )
);

router.get(
  '/carcasse/:zacharie_carcasse_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcasseDetailResponse>,
      next: express.NextFunction
    ) => {
      const carcasse = await prisma.carcasse.findUnique({
        where: { zacharie_carcasse_id: req.params.zacharie_carcasse_id },
        include: {
          CarcasseIntermediaire: {
            orderBy: { created_at: 'asc' },
            include: {
              CarcasseIntermediaireEntity: {
                select: {
                  nom_d_usage: true,
                  type: true,
                  numero_ddecpp: true,
                  address_ligne_1: true,
                  code_postal: true,
                  ville: true,
                },
              },
              CarcasseIntermediaireUser: { select: { email: true } },
            },
          },
          Fei: true,
        },
      });

      if (!carcasse) {
        res.status(404).send({ ok: false, data: null as never, error: 'Carcasse not found' });
        return;
      }

      let depotEntity = null;
      if (carcasse.premier_detenteur_depot_entity_id) {
        depotEntity = await prisma.entity.findUnique({
          where: { id: carcasse.premier_detenteur_depot_entity_id },
          select: {
            nom_d_usage: true,
            numero_ddecpp: true,
            address_ligne_1: true,
            code_postal: true,
            ville: true,
          },
        });
      }

      res.status(200).send({ ok: true, data: { carcasse, depotEntity }, error: '' });
    }
  )
);

export default router;
