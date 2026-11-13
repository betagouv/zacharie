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
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

const zodQuerySchema = z.object({
  page: z.string(),
  after: z.string(),
  limit: z.string(),
  withDeleted: z.string(),
  reloadVersion: z.string().optional(),
});

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetResponse>) => {
    // Un chasseur formé (numéro CFEI) non encore activé peut charger ses fiches en préparation.
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

    // Parse and validate query parameters
    const queryResult = zodQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Invalid query parameters' });
      return;
    }
    const { page, after, limit, withDeleted, reloadVersion } = queryResult.data;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const includeDeleted = withDeleted === 'true';
    const requestedAfterDate = Number(after) ? new Date(Number(after)) : undefined;
    // dernier pull antérieur à une correction de données, ou rechargement demandé pour cet utilisateur
    // depuis le dernier pull de l'appareil : on renvoie tout le périmètre
    const fullReload =
      (!!requestedAfterDate && requestedAfterDate < FORCE_FULL_RELOAD_AFTER) ||
      (reloadVersion !== undefined && Number(reloadVersion) < req.user.carcasses_reload_version);
    const afterDate = fullReload ? undefined : requestedAfterDate;

    // Base query conditions : périmètre d'accès role-aware (partagé avec /refusees/:fei_numero).
    const accessWhere = await getCarcasseAccessWhere(req.user);
    if (!accessWhere) {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({
        ok: false,
        data: null,
        error: "Vous n'avez pas les permissions.",
      });
      return;
    }
    const where: Prisma.CarcasseWhereInput = { ...accessWhere };

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      where.updated_at = { gte: afterDate };
    }

    // Execute count and findMany in parallel
    const [total, carcasses] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    const feiNumeros = new Set<string>();
    const carcassesIds = new Set<string>();
    const userIds = new Set<string>();
    const entityIds = new Set<string>();

    for (const carcasse of carcasses) {
      if (carcasse.examinateur_initial_user_id) userIds.add(carcasse.examinateur_initial_user_id);
      if (carcasse.premier_detenteur_user_id) userIds.add(carcasse.premier_detenteur_user_id);
      if (carcasse.current_owner_user_id) userIds.add(carcasse.current_owner_user_id);
      if (carcasse.next_owner_user_id) userIds.add(carcasse.next_owner_user_id);
      if (carcasse.prev_owner_user_id) userIds.add(carcasse.prev_owner_user_id);
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

    // Modif requests are loaded BY carcasse (not embedded): the client keys its full-history map by
    // zacharie_carcasse_id. Every modif mutation bumps its carcasse's updated_at, so the carcasses in
    // this delta carry the full set of modif requests that changed.
    // Le périmètre se lit sur les carcasses : une fiche sans carcasse n'y entre pas. Ses rattachés
    // directs la reçoivent quand même (une seule fois, en première page), sinon elle disparaît de
    // leur appareil après une déconnexion.
    const emptyFeisWhere: Prisma.FeiWhereInput = {
      Carcasses: { none: {} },
      OR: [{ created_by_user_id: req.user.id }, { examinateur_initial_user_id: req.user.id }],
    };
    if (!includeDeleted) emptyFeisWhere.deleted_at = null;
    if (afterDate) emptyFeisWhere.updated_at = { gte: afterDate };

    const [feisWithCarcasses, emptyFeis, carcassesIntermediaires, carcasseModifRequests] = await Promise.all([
      prisma.fei.findMany({ where: { numero: { in: [...feiNumeros].filter(Boolean) } } }),
      parsedPage === 0 ? prisma.fei.findMany({ where: emptyFeisWhere }) : [],
      prisma.carcasseIntermediaire.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
      prisma.carcasseModificationRequest.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
    ]);
    const feis = [...feisWithCarcasses, ...emptyFeis];

    for (const intermediaire of carcassesIntermediaires) {
      // affiché dans le parcours de la fiche et le motif de refus : qui, au sein de l'entité, a pris en charge
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
        hasMore: carcasses.length === parsedLimit,
        total,
        fullReload,
        reloadVersion: req.user.carcasses_reload_version,
      },
      error: '',
    });
  })
);

// Nombre de carcasses non supprimées du périmètre de synchro (même périmètre que GET /, sans filtre
// updated_at). Le client le compare à son store local pour remonter les écarts à Sentry.
// Les carcasses refusées ou manquantes sont exclues des deux côtés : GET /refusees/:fei_numero en
// ajoute au store qui sont hors de ce périmètre, et le client ne peut pas les distinguer des autres.
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

    const count = await prisma.carcasse.count({
      where: {
        AND: [
          accessWhere,
          {
            deleted_at: null,
            intermediaire_carcasse_refus_intermediaire_id: null,
            OR: [{ intermediaire_carcasse_manquante: null }, { intermediaire_carcasse_manquante: false }],
          },
        ],
      },
    });
    res.status(200).send({ ok: true, data: { count }, error: '' });
  })
);

// Carcasses refusées ou manquantes en amont, hors du périmètre de synchro delta de l'utilisateur.
// Une carcasse refusée « sort du circuit » (ses next/current_owner ne suivent plus la transmission
// de la fiche) et son updated_at ne rebouge pas ensuite : le pull delta /carcasse ne la renvoie donc
// jamais aux détenteurs suivants ni au SVI, alors qu'elle fait partie de leur champ de contrôle.
// Cette route les fournit à la demande (à l'ouverture d'une fiche), pour merge dans le store.
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

    // Autorisation : l'utilisateur doit avoir accès à au moins une carcasse de la fiche (via son
    // périmètre normal) pour consulter les carcasses hors périmètre de cette même fiche.
    // On en profite pour relever ses groupes de dispatch (premier détenteur → prochain détenteur)
    // sur cette fiche : c'est la seule partie de la fiche qui le concerne.
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

    // Les carcasses refusées ou manquantes de MES groupes de dispatch, sorties de mon périmètre au
    // moment du refus. Strictement pas les autres carcasses hors périmètre de la fiche : celles
    // parties chez un autre destinataire ne sont pas dans mon champ de contrôle, et si elles
    // entraient dans le store elles pollueraient les vues transverses (recherche, transmissions).
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
          {
            OR: [
              { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
              { intermediaire_carcasse_manquante: true },
            ],
          },
        ],
      },
    });

    const carcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);
    const carcassesIntermediaires = carcasseIds.length
      ? await prisma.carcasseIntermediaire.findMany({
          where: { zacharie_carcasse_id: { in: carcasseIds } },
        })
      : [];

    // Entités référencées par ces carcasses et leurs intermédiaires (noms des destinataires, motifs
    // de refus) — nécessaires à l'affichage côté front.
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
