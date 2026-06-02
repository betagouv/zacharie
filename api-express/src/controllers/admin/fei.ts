import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma } from '@prisma/client';
import type { AdminFeisResponse, AdminFeiDetailResponse } from '~/types/responses';

router.get(
  '/feis',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminFeisResponse>, next: express.NextFunction) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';

      const where: Prisma.FeiWhereInput = {
        deleted_at: null,
        ...(search
          ? {
              OR: [
                { numero: { contains: search, mode: 'insensitive' as const } },
                { commune_mise_a_mort: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [feis, total] = await Promise.all([
        prisma.fei.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            FeiExaminateurInitialUser: { select: { email: true } },
            FeiPremierDetenteurUser: { select: { email: true } },
            FeiPremierDetenteurEntity: { select: { nom_d_usage: true } },
            FeiSviEntity: { select: { nom_d_usage: true } },
            _count: { select: { Carcasses: true } },
          },
        }),
        prisma.fei.count({ where }),
      ]);

      res.status(200).send({ ok: true, data: { feis, total }, error: '' });
    }
  )
);

router.get(
  '/fei/:fei_numero',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeiDetailResponse>,
      next: express.NextFunction
    ) => {
      const fei = await prisma.fei.findUnique({
        where: { numero: req.params.fei_numero },
        include: {
          Carcasses: {
            orderBy: { created_at: 'asc' },
            include: {
              _count: { select: { CarcasseIntermediaire: true } },
            },
          },
          CarcasseIntermediaire: {
            orderBy: { created_at: 'asc' },
            include: {
              CarcasseIntermediaireEntity: {
                select: {
                  nom_d_usage: true,
                  type: true,
                  numero_ddecpp: true,
                },
              },
              CarcasseIntermediaireUser: { select: { email: true } },
            },
          },
          FeiCreatedByUser: { select: { email: true } },
          FeiExaminateurInitialUser: { select: { email: true } },
          FeiPremierDetenteurUser: { select: { email: true } },
          FeiPremierDetenteurEntity: { select: { nom_d_usage: true } },
          FeiSviEntity: { select: { nom_d_usage: true } },
          FeiSviUser: { select: { email: true } },
        },
      });

      if (!fei) {
        res.status(404).send({ ok: false, data: null as never, error: 'Fiche not found' });
        return;
      }

      res.status(200).send({ ok: true, data: { fei }, error: '' });
    }
  )
);

export default router;
