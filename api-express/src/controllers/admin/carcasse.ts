import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma, CarcasseStatus, CarcasseType, FeiOwnerRole } from '@prisma/client';
import type {
  AdminCarcassesIntermediairesResponse,
  AdminCarcassesResponse,
  AdminCarcasseDetailResponse,
  AdminCarcassesFilterOptionsResponse,
} from '~/types/responses';
import {
  parseList,
  parseEnumList,
  parseDateRange,
  parseDateTimeRange,
  entityLabel,
  userLabel,
  sortByLabel,
} from '~/utils/admin-list-filters';

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

      const statuts = parseEnumList(req.query.statuts, Object.values(CarcasseStatus));
      const types = parseEnumList(req.query.types, Object.values(CarcasseType));
      const especes = parseList(req.query.especes);
      const sviIds = parseList(req.query.svi_ids);
      const etgIds = parseList(req.query.etg_ids);
      const collecteurIds = parseList(req.query.collecteur_ids);
      const premierDetenteurIds = parseList(req.query.premier_detenteur_ids);
      const examinateurIds = parseList(req.query.examinateur_ids);
      const dateMiseAMort = parseDateRange(req.query.date_mise_a_mort_from, req.query.date_mise_a_mort_to);
      const createdAt = parseDateTimeRange(req.query.created_at_from, req.query.created_at_to);

      const and: Array<Prisma.CarcasseWhereInput> = [];
      if (search) {
        and.push({
          OR: [
            { numero_bracelet: { contains: search, mode: 'insensitive' } },
            { fei_numero: { contains: search, mode: 'insensitive' } },
            { espece: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
      if (statuts.length) and.push({ svi_carcasse_status: { in: statuts } });
      if (types.length) and.push({ type: { in: types } });
      if (especes.length) and.push({ espece: { in: especes } });
      if (sviIds.length) and.push({ svi_entity_id: { in: sviIds } });
      // `latest_intermediaire_entity_id` ne porte pas l'ETG/collecteur (il vaut le SVI
      // une fois la carcasse assignée) : on passe par les intermédiaires, qui gardent
      // tout l'historique avec leur rôle.
      if (etgIds.length) {
        and.push({
          CarcasseIntermediaire: {
            some: {
              deleted_at: null,
              intermediaire_role: FeiOwnerRole.ETG,
              intermediaire_entity_id: { in: etgIds },
            },
          },
        });
      }
      if (collecteurIds.length) {
        and.push({
          CarcasseIntermediaire: {
            some: {
              deleted_at: null,
              intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
              intermediaire_entity_id: { in: collecteurIds },
            },
          },
        });
      }
      if (premierDetenteurIds.length) {
        and.push({
          OR: [
            { premier_detenteur_entity_id: { in: premierDetenteurIds } },
            { premier_detenteur_user_id: { in: premierDetenteurIds } },
          ],
        });
      }
      if (examinateurIds.length) and.push({ examinateur_initial_user_id: { in: examinateurIds } });
      if (dateMiseAMort) and.push({ date_mise_a_mort: dateMiseAMort });
      if (createdAt) and.push({ created_at: createdAt });

      // Les carcasses supprimées restent listées : les routes admin les affichent, badgées.
      const where: Prisma.CarcasseWhereInput = and.length ? { AND: and } : {};

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

// Options des listes déroulantes de filtres : uniquement les valeurs et acteurs qui
// apparaissent réellement sur des carcasses, pour garder des listes courtes.
router.get(
  '/carcasses/filter-options',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcassesFilterOptionsResponse>,
      next: express.NextFunction
    ) => {
      const [especeRows, sviRows, intermediaireRows, pdEntityRows, pdUserRows, examinateurRows] =
        await Promise.all([
          prisma.carcasse.groupBy({ by: ['espece'], where: { espece: { not: null } } }),
          prisma.carcasse.groupBy({ by: ['svi_entity_id'], where: { svi_entity_id: { not: null } } }),
          // Le rôle porté par l'intermédiaire lui-même est plus fiable que Entity.type :
          // c'est celui sur lequel le filtre s'appuie.
          prisma.carcasseIntermediaire.groupBy({
            by: ['intermediaire_entity_id', 'intermediaire_role'],
            where: { deleted_at: null },
          }),
          prisma.carcasse.groupBy({
            by: ['premier_detenteur_entity_id'],
            where: { premier_detenteur_entity_id: { not: null } },
          }),
          prisma.carcasse.groupBy({
            by: ['premier_detenteur_user_id'],
            where: { premier_detenteur_user_id: { not: null } },
          }),
          prisma.carcasse.groupBy({
            by: ['examinateur_initial_user_id'],
            where: { examinateur_initial_user_id: { not: null } },
          }),
        ]);

      const sviIds = sviRows.map((row) => row.svi_entity_id!);
      const etgIds = [
        ...new Set(
          intermediaireRows
            .filter((row) => row.intermediaire_role === FeiOwnerRole.ETG)
            .map((row) => row.intermediaire_entity_id)
        ),
      ];
      const collecteurIds = [
        ...new Set(
          intermediaireRows
            .filter((row) => row.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO)
            .map((row) => row.intermediaire_entity_id)
        ),
      ];
      const pdEntityIds = pdEntityRows.map((row) => row.premier_detenteur_entity_id!);
      const pdUserIds = pdUserRows.map((row) => row.premier_detenteur_user_id!);
      const examinateurIds = examinateurRows.map((row) => row.examinateur_initial_user_id!);

      const [entities, users] = await Promise.all([
        prisma.entity.findMany({
          where: { id: { in: [...sviIds, ...etgIds, ...collecteurIds, ...pdEntityIds] } },
          select: { id: true, nom_d_usage: true, raison_sociale: true },
        }),
        prisma.user.findMany({
          where: { id: { in: [...pdUserIds, ...examinateurIds] } },
          select: { id: true, email: true, prenom: true, nom_de_famille: true },
        }),
      ]);

      const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
      const usersById = new Map(users.map((user) => [user.id, user]));
      const toEntityOption = (id: string) => ({
        id,
        label: entitiesById.has(id) ? entityLabel(entitiesById.get(id)!) : id,
      });
      const toUserOption = (id: string) => ({
        id,
        label: usersById.has(id) ? userLabel(usersById.get(id)!) : id,
      });

      res.status(200).send({
        ok: true,
        data: {
          especes: sortByLabel(especeRows.map((row) => ({ id: row.espece!, label: row.espece! }))),
          svis: sortByLabel(sviIds.map(toEntityOption)),
          etgs: sortByLabel(etgIds.map(toEntityOption)),
          collecteurs: sortByLabel(collecteurIds.map(toEntityOption)),
          premiersDetenteurs: sortByLabel([
            ...pdEntityIds.map(toEntityOption),
            ...pdUserIds.map(toUserOption),
          ]),
          examinateurs: sortByLabel(examinateurIds.map(toUserOption)),
        },
        error: '',
      });
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
