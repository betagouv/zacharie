import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { AdminSearchResponse } from '~/types/responses';

const RESULTS_PER_TYPE = 10;

// Recherche globale (⌘K) : quelques résultats par type, éléments supprimés inclus
router.get(
  '/search',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminSearchResponse>, next: express.NextFunction) => {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2) {
        res
          .status(200)
          .send({ ok: true, data: { users: [], entities: [], feis: [], carcasses: [] }, error: '' });
        return;
      }
      const contains = { contains: q, mode: 'insensitive' as const };

      const [users, entities, feis, carcasses] = await Promise.all([
        prisma.user.findMany({
          where: {
            OR: [
              { email: contains },
              { prenom: contains },
              { nom_de_famille: contains },
              { numero_cfei: contains },
            ],
          },
          select: {
            id: true,
            email: true,
            prenom: true,
            nom_de_famille: true,
            roles: true,
            deleted_at: true,
          },
          orderBy: { updated_at: 'desc' },
          take: RESULTS_PER_TYPE,
        }),
        prisma.entity.findMany({
          where: {
            OR: [
              { nom_d_usage: contains },
              { raison_sociale: contains },
              { siret: contains },
              { numero_ddecpp: contains },
            ],
          },
          select: { id: true, nom_d_usage: true, type: true, ville: true, deleted_at: true },
          orderBy: { updated_at: 'desc' },
          take: RESULTS_PER_TYPE,
        }),
        prisma.fei.findMany({
          where: { numero: contains },
          select: { numero: true, date_mise_a_mort: true, commune_mise_a_mort: true, deleted_at: true },
          orderBy: { created_at: 'desc' },
          take: RESULTS_PER_TYPE,
        }),
        prisma.carcasse.findMany({
          where: { OR: [{ numero_bracelet: contains }, { fei_numero: contains }] },
          select: {
            zacharie_carcasse_id: true,
            numero_bracelet: true,
            fei_numero: true,
            espece: true,
            deleted_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: RESULTS_PER_TYPE,
        }),
      ]);

      res.status(200).send({ ok: true, data: { users, entities, feis, carcasses }, error: '' });
    }
  )
);

export default router;
