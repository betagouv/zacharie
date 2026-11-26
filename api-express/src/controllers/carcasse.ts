import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type {
  CarcassesCountResponse,
  CarcassesGetResponse,
  CarcassesRefuseesResponse,
} from '~/types/responses';
import prisma from '~/prisma';
import { EntityRelationType, Prisma, UserRoles } from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import type { EntityWithUserRelation } from '~/types/entity';
import z from 'zod';
import { capture } from '~/third-parties/sentry';
import { userFeiSelect } from '~/types/user';
import {
  findScopeCarcassesPage,
  getCarcasseAccessWhere,
  getCarcasseScopeBranches,
} from '~/utils/carcasse-access';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

const zodQuerySchema = z.object({
  cursorUpdatedAt: z.string().regex(/^\d+$/).optional(),
  cursorId: z.string().min(1).optional(),
  page: z.string().optional(),
  after: z.string(),
  limit: z.coerce.number().int().min(1).max(10000),
  withDeleted: z.string(),
  reloadVersion: z.string().optional(),
});

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetResponse>) => {
    const isExaminateurInitialNotYetActivated =
      req.user.roles.includes(UserRoles.CHASSEUR) && !!req.user.numero_cfei;
    if (!req.user.activated && !isExaminateurInitialNotYetActivated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }

    const queryResult = zodQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Invalid query parameters' });
      return;
    }
    const { cursorUpdatedAt, cursorId, page, after, limit, withDeleted, reloadVersion } = queryResult.data;

    if (page !== undefined && page !== '0') {
      res.status(400).send({ ok: false, data: null, error: 'Pagination par page abandonnée' });
      return;
    }
    const cursorDate = cursorUpdatedAt ? new Date(Number(cursorUpdatedAt)) : undefined;
    const requestedAfterDate = Number(after) ? new Date(Number(after)) : undefined;
    if (
      (cursorDate === undefined) !== (cursorId === undefined) ||
      (cursorDate && isNaN(cursorDate.getTime())) ||
      (requestedAfterDate && isNaN(requestedAfterDate.getTime()))
    ) {
      res.status(400).send({ ok: false, data: null, error: 'Invalid query parameters' });
      return;
    }
    const isFirstPage = !cursorDate;
    const includeDeleted = withDeleted === 'true';
    const fullReload =
      (!!requestedAfterDate && requestedAfterDate < FORCE_FULL_RELOAD_AFTER) ||
      (reloadVersion !== undefined && Number(reloadVersion) < req.user.carcasses_reload_version);
    const afterDate = fullReload ? undefined : requestedAfterDate;

    const userEntityIds = await getUserCarcasseEntityIds(req.user.id);
    const scopeBranches = getCarcasseScopeBranches(req.user, userEntityIds);
    if (!scopeBranches) {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({
        ok: false,
        data: null,
        error: "Vous n'avez pas les permissions.",
      });
      return;
    }

    const { carcasses, hasMore } = await findScopeCarcassesPage({
      branches: scopeBranches,
      includeDeleted,
      afterDate,
      cursor: cursorDate && cursorId ? { updatedAt: cursorDate, id: cursorId } : undefined,
      limit,
    });

    if (page !== undefined && hasMore) {
      res.status(400).send({ ok: false, data: null, error: "Mise à jour de l'application requise" });
      return;
    }

    const feiNumeros = new Set<string>();
    const carcassesIds = new Set<string>();
    const userIds = new Set<string>();
    const entityIds = new Set<string>();

    for (const carcasse of carcasses) {
      if (carcasse.examinateur_initial_user_id) userIds.add(carcasse.examinateur_initial_user_id);
      if (carcasse.premier_detenteur_user_id) userIds.add(carcasse.premier_detenteur_user_id);
      if (carcasse.svi_user_id) userIds.add(carcasse.svi_user_id);
      if (carcasse.created_by_user_id) userIds.add(carcasse.created_by_user_id);
      if (carcasse.premier_detenteur_entity_id) entityIds.add(carcasse.premier_detenteur_entity_id);
      if (carcasse.premier_detenteur_depot_entity_id)
        entityIds.add(carcasse.premier_detenteur_depot_entity_id);
      if (carcasse.svi_entity_id) entityIds.add(carcasse.svi_entity_id);
      if (carcasse.current_owner_entity_id) entityIds.add(carcasse.current_owner_entity_id);
      if (carcasse.next_owner_entity_id) entityIds.add(carcasse.next_owner_entity_id);
      if (carcasse.prev_owner_entity_id) entityIds.add(carcasse.prev_owner_entity_id);
      if (carcasse.next_owner_sous_traite_by_entity_id)
        entityIds.add(carcasse.next_owner_sous_traite_by_entity_id);
      if (carcasse.latest_intermediaire_entity_id) entityIds.add(carcasse.latest_intermediaire_entity_id);
      if (carcasse.intermediaire_closed_by_entity_id)
        entityIds.add(carcasse.intermediaire_closed_by_entity_id);
      carcassesIds.add(carcasse.zacharie_carcasse_id);
      feiNumeros.add(carcasse.fei_numero);
    }

    const emptyFeisWhere: Prisma.FeiWhereInput = {
      Carcasses: { none: {} },
      OR: [{ created_by_user_id: req.user.id }, { examinateur_initial_user_id: req.user.id }],
    };
    if (!includeDeleted) emptyFeisWhere.deleted_at = null;
    if (afterDate) emptyFeisWhere.updated_at = { gte: afterDate };

    const [feisWithCarcasses, emptyFeis, carcassesIntermediaires, carcasseModifRequests] = await Promise.all([
      prisma.fei.findMany({ where: { numero: { in: [...feiNumeros].filter(Boolean) } } }),
      isFirstPage ? prisma.fei.findMany({ where: emptyFeisWhere }) : [],
      prisma.carcasseIntermediaire.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
      prisma.carcasseModificationRequest.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
    ]);
    const feis = [...feisWithCarcasses, ...emptyFeis];

    for (const intermediaire of carcassesIntermediaires) {
      userIds.add(intermediaire.intermediaire_user_id);
      entityIds.add(intermediaire.intermediaire_entity_id!);
      if (intermediaire.intermediaire_depot_entity_id) {
        entityIds.add(intermediaire.intermediaire_depot_entity_id);
      }
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds].filter(Boolean) } },
      select: userFeiSelect,
    });
    const entities = await prisma.entity
      .findMany({ where: { id: { in: [...entityIds].filter(Boolean) } } })
      .then((entitiesFromFeis) =>
        entitiesFromFeis.map(
          (entity): EntityWithUserRelation => ({
            ...entity,
            relation: EntityRelationType.NONE,
            relationStatus: undefined,
          })
        )
      );

    res.status(200).json({
      ok: true,
      data: {
        carcasses,
        feis,
        users,
        entities,
        carcassesIntermediaires,
        carcasseModifRequests,
        hasMore,
        fullReload,
        reloadVersion: req.user.carcasses_reload_version,
      },
      error: '',
    });
  })
);

const REFUSEE_OU_MANQUANTE: Prisma.CarcasseWhereInput = {
  OR: [
    { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
    { intermediaire_carcasse_manquante: true },
  ],
};

router.get(
  '/count',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesCountResponse>) => {
    const isExaminateurInitialNotYetActivated =
      req.user.roles.includes(UserRoles.CHASSEUR) && !!req.user.numero_cfei;
    if (!req.user.activated && !isExaminateurInitialNotYetActivated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }

    const accessWhere = await getCarcasseAccessWhere(req.user);
    if (!accessWhere) {
      res.status(403).send({ ok: false, data: null, error: "Vous n'avez pas les permissions." });
      return;
    }

    const count = await prisma.carcasse.count({ where: { ...accessWhere, deleted_at: null } });

    const groupesDuPerimetre = await prisma.carcasse.findMany({
      where: accessWhere,
      select: { fei_numero: true, premier_detenteur_prochain_detenteur_id_cache: true },
      distinct: ['fei_numero', 'premier_detenteur_prochain_detenteur_id_cache'],
    });
    const groupeKey = (c: {
      fei_numero: string;
      premier_detenteur_prochain_detenteur_id_cache: string | null;
    }) => JSON.stringify([c.fei_numero, c.premier_detenteur_prochain_detenteur_id_cache]);
    const groupes = new Set(groupesDuPerimetre.map(groupeKey));
    const refuseesHorsPerimetre = groupesDuPerimetre.length
      ? await prisma.carcasse.findMany({
          where: {
            fei_numero: { in: [...new Set(groupesDuPerimetre.map((c) => c.fei_numero))] },
            NOT: accessWhere,
            ...REFUSEE_OU_MANQUANTE,
          },
          select: {
            zacharie_carcasse_id: true,
            fei_numero: true,
            premier_detenteur_prochain_detenteur_id_cache: true,
          },
        })
      : [];
    const refuseesHorsPerimetreIds = refuseesHorsPerimetre
      .filter((c) => groupes.has(groupeKey(c)))
      .map((c) => c.zacharie_carcasse_id);

    res.status(200).send({ ok: true, data: { count, refuseesHorsPerimetreIds }, error: '' });
  })
);

router.get(
  '/refusees/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesRefuseesResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    const feiNumero = req.params.fei_numero;
    if (!feiNumero) {
      res.status(400).send({ ok: false, data: null, error: 'Le numéro de fiche est obligatoire' });
      return;
    }

    const accessWhere = await getCarcasseAccessWhere(req.user);
    if (!accessWhere) {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({ ok: false, data: null, error: "Vous n'avez pas les permissions." });
      return;
    }

    const inScopeCarcasses = await prisma.carcasse.findMany({
      where: { fei_numero: feiNumero, ...accessWhere },
      select: { premier_detenteur_prochain_detenteur_id_cache: true },
      distinct: ['premier_detenteur_prochain_detenteur_id_cache'],
    });
    if (inScopeCarcasses.length === 0) {
      res.status(403).send({ ok: false, data: null, error: "Vous n'avez pas accès à cette fiche." });
      return;
    }
    const myDispatchIds = inScopeCarcasses.map((c) => c.premier_detenteur_prochain_detenteur_id_cache);

    const carcasses = await prisma.carcasse.findMany({
      where: {
        fei_numero: feiNumero,
        NOT: accessWhere,
        AND: [
          {
            OR: [
              { premier_detenteur_prochain_detenteur_id_cache: { in: myDispatchIds.filter(Boolean) } },
              ...(myDispatchIds.includes(null)
                ? [{ premier_detenteur_prochain_detenteur_id_cache: null }]
                : []),
            ],
          },
          REFUSEE_OU_MANQUANTE,
        ],
      },
    });

    const carcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);
    const carcassesIntermediaires = carcasseIds.length
      ? await prisma.carcasseIntermediaire.findMany({
          where: { zacharie_carcasse_id: { in: carcasseIds } },
        })
      : [];

    const entityIds = new Set<string>();
    for (const c of carcasses) {
      if (c.current_owner_entity_id) entityIds.add(c.current_owner_entity_id);
      if (c.next_owner_entity_id) entityIds.add(c.next_owner_entity_id);
      if (c.prev_owner_entity_id) entityIds.add(c.prev_owner_entity_id);
      if (c.svi_entity_id) entityIds.add(c.svi_entity_id);
      if (c.latest_intermediaire_entity_id) entityIds.add(c.latest_intermediaire_entity_id);
    }
    for (const i of carcassesIntermediaires) {
      if (i.intermediaire_entity_id) entityIds.add(i.intermediaire_entity_id);
      if (i.intermediaire_depot_entity_id) entityIds.add(i.intermediaire_depot_entity_id);
    }
    const entities = (
      await prisma.entity.findMany({ where: { id: { in: [...entityIds].filter(Boolean) } } })
    ).map(
      (entity): EntityWithUserRelation => ({
        ...entity,
        relation: EntityRelationType.NONE,
        relationStatus: undefined,
      })
    );

    res.status(200).json({
      ok: true,
      data: { carcasses, carcassesIntermediaires, entities },
      error: '',
    });
  })
);

export default router;
