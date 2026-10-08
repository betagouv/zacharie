import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import type {
  AdminFeisResponse,
  AdminFeiDetailResponse,
  AdminFeisFilterOptionsResponse,
  AdminSoftDeleteResponse,
} from '~/types/responses';
import { nextVersion } from '~/utils/sync-version';
import {
  parseList,
  parseDateRange,
  parseDateTimeRange,
  entityLabel,
  userLabel,
  sortByLabel,
} from '~/utils/admin-list-filters';

router.get(
  '/feis',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminFeisResponse>, next: express.NextFunction) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';

      const examinateurIds = parseList(req.query.examinateur_ids);
      const premierDetenteurIds = parseList(req.query.premier_detenteur_ids);
      const creationContexts = parseList(req.query.creation_context);
      const avecCarcasses = parseList(req.query.avec_carcasses);
      const dateMiseAMort = parseDateRange(req.query.date_mise_a_mort_from, req.query.date_mise_a_mort_to);
      const createdAt = parseDateTimeRange(req.query.created_at_from, req.query.created_at_to);

      // Chaque filtre est un bloc indépendant : on les empile dans un AND pour ne pas
      // écraser le OR de la recherche.
      const and: Array<Prisma.FeiWhereInput> = [];
      if (search) {
        and.push({
          OR: [
            { numero: { contains: search, mode: 'insensitive' } },
            { commune_mise_a_mort: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
      if (examinateurIds.length) and.push({ examinateur_initial_user_id: { in: examinateurIds } });
      if (premierDetenteurIds.length) {
        and.push({
          OR: [
            { premier_detenteur_entity_id: { in: premierDetenteurIds } },
            { premier_detenteur_user_id: { in: premierDetenteurIds } },
          ],
        });
      }
      if (creationContexts.length) and.push({ creation_context: { in: creationContexts } });
      if (dateMiseAMort) and.push({ date_mise_a_mort: dateMiseAMort });
      if (createdAt) and.push({ created_at: createdAt });
      // Les deux cases cochées ne filtrent rien, comme n'en cocher aucune.
      if (avecCarcasses.length === 1) {
        and.push(
          avecCarcasses[0] === 'avec'
            ? { Carcasses: { some: { deleted_at: null } } }
            : { Carcasses: { none: { deleted_at: null } } }
        );
      }

      // Les fiches supprimées restent listées ici : les routes admin les affichent, badgées.
      const where: Prisma.FeiWhereInput = and.length ? { AND: and } : {};

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
            _count: { select: { Carcasses: true } },
          },
        }),
        prisma.fei.count({ where }),
      ]);

      res.status(200).send({ ok: true, data: { feis, total }, error: '' });
    }
  )
);

// Options des listes déroulantes de filtres : uniquement les acteurs qui apparaissent
// réellement dans des fiches, pour garder des listes courtes.
router.get(
  '/feis/filter-options',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeisFilterOptionsResponse>,
      next: express.NextFunction
    ) => {
      const [examinateurRows, premierDetenteurEntityRows, premierDetenteurUserRows] = await Promise.all([
        prisma.fei.groupBy({
          by: ['examinateur_initial_user_id'],
          where: { examinateur_initial_user_id: { not: null } },
        }),
        prisma.fei.groupBy({
          by: ['premier_detenteur_entity_id'],
          where: { premier_detenteur_entity_id: { not: null } },
        }),
        prisma.fei.groupBy({
          by: ['premier_detenteur_user_id'],
          where: { premier_detenteur_user_id: { not: null } },
        }),
      ]);

      const examinateurIds = examinateurRows.map((row) => row.examinateur_initial_user_id!);
      const premierDetenteurEntityIds = premierDetenteurEntityRows.map(
        (row) => row.premier_detenteur_entity_id!
      );
      const premierDetenteurUserIds = premierDetenteurUserRows.map((row) => row.premier_detenteur_user_id!);

      const [users, entities] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: [...examinateurIds, ...premierDetenteurUserIds] } },
          select: { id: true, email: true, prenom: true, nom_de_famille: true },
        }),
        prisma.entity.findMany({
          where: { id: { in: premierDetenteurEntityIds } },
          select: { id: true, nom_d_usage: true, raison_sociale: true },
        }),
      ]);

      const usersById = new Map(users.map((user) => [user.id, user]));
      const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));

      const examinateurs = sortByLabel(
        examinateurIds.map((id) => ({
          id,
          label: usersById.has(id) ? userLabel(usersById.get(id)!) : id,
        }))
      );
      const premiersDetenteurs = sortByLabel([
        ...premierDetenteurEntityIds.map((id) => ({
          id,
          label: entitiesById.has(id) ? entityLabel(entitiesById.get(id)!) : id,
        })),
        ...premierDetenteurUserIds.map((id) => ({
          id,
          label: usersById.has(id) ? userLabel(usersById.get(id)!) : id,
        })),
      ]);

      res.status(200).send({ ok: true, data: { examinateurs, premiersDetenteurs }, error: '' });
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

// Soft delete d'une fiche de test ou de démo, avec ses carcasses et lignes d'intermédiaire, comme la
// suppression par l'examinateur initial (syncFei). `nextVersion` rend périmée toute écriture hors
// ligne d'un client sur ces lignes, et le bump d'updated_at leur propage la suppression au prochain pull.
// Les stats (vues matérialisées, Metabase) excluent déjà les lignes où deleted_at est renseigné.
router.post(
  '/fei/:fei_numero/soft-delete',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminSoftDeleteResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user as User;
      const numero = req.params.fei_numero;
      const fei = await prisma.fei.findUnique({ where: { numero } });
      if (!fei) {
        res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
        return;
      }
      if (fei.deleted_at) {
        res.status(400).send({ ok: false, data: null, error: 'La fiche est déjà supprimée' });
        return;
      }

      const deleted_at = new Date();
      await prisma.$transaction([
        prisma.fei.update({ where: { numero }, data: { deleted_at, ...nextVersion(user.id) } }),
        prisma.carcasse.updateMany({
          where: { fei_numero: numero, deleted_at: null },
          data: { deleted_at, ...nextVersion(user.id) },
        }),
        prisma.carcasseIntermediaire.updateMany({
          where: { fei_numero: numero, deleted_at: null },
          data: { deleted_at, ...nextVersion(user.id) },
        }),
      ]);

      res.status(200).send({ ok: true, data: { deleted_at }, error: '' });
    }
  )
);

export default router;
