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
  getCcgScopeBranches,
} from '~/utils/carcasse-access';
import { getUserAdminCcgIds, getUserCarcasseEntityIds } from '~/utils/user-entities';
import { getCcgIntermediaires, getCcgOnlyCarcasseIds, redactCarcasseForCcg } from '~/utils/ccg-read-only';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

const zodQuerySchema = z.object({
  // pagination par curseur : updated_at (ms) et id de la dernière carcasse reçue, absents en première page
  cursorUpdatedAt: z.string().regex(/^\d+$/).optional(),
  cursorId: z.string().min(1).optional(),
  // envoyé seulement par un bundle antérieur à la pagination par curseur
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
    const { cursorUpdatedAt, cursorId, page, after, limit, withDeleted, reloadVersion } = queryResult.data;

    // Un bundle resté sur la pagination par page recevrait la première page en boucle : on la lui sert
    // seulement si elle tient en une page (cf plus bas), et on refuse toujours la suite.
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
    // dernier pull antérieur à une correction de données, ou rechargement demandé pour cet utilisateur
    // depuis le dernier pull de l'appareil : on renvoie tout le périmètre
    const fullReload =
      (!!requestedAfterDate && requestedAfterDate < FORCE_FULL_RELOAD_AFTER) ||
      (reloadVersion !== undefined && Number(reloadVersion) < req.user.carcasses_reload_version);
    const afterDate = fullReload ? undefined : requestedAfterDate;

    // Périmètre d'accès role-aware, le même que getCarcasseAccessWhere (partagé avec /refusees/:fei_numero).
    const userEntityIds = await getUserCarcasseEntityIds(req.user.id);
    // fédération (FNC, FRC, FDC sans être chasseur) : aucune fiche à elle, seulement celles de ses CCG
    const isFederation = req.user.roles.includes(UserRoles.FEDERATION);
    const canOwnCcg = isFederation || req.user.roles.includes(UserRoles.CHASSEUR);
    const scopeBranches = isFederation ? [] : getCarcasseScopeBranches(req.user, userEntityIds);
    if (!scopeBranches) {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({
        ok: false,
        data: null,
        error: "Vous n'avez pas les permissions.",
      });
      return;
    }

    const ccgIds = canOwnCcg ? await getUserAdminCcgIds(req.user.id) : [];

    // Page suivante : strictement après la dernière carcasse reçue, dans l'ordre (updated_at, id)
    // décroissant (cf e2e/load/README.md).
    const { carcasses: pageCarcasses, hasMore } = await findScopeCarcassesPage({
      branches: [...scopeBranches, ...getCcgScopeBranches(ccgIds)],
      includeDeleted,
      afterDate,
      cursor: cursorDate && cursorId ? { updatedAt: cursorDate, id: cursorId } : undefined,
      limit,
    });

    // Ancien bundle dont le pull dépasse une page : il ne peut pas lire la suite. On refuse avant de
    // charger fiches, intermédiaires et utilisateurs, pour ne pas les renvoyer à chaque synchro.
    if (page !== undefined && hasMore) {
      res.status(400).send({ ok: false, data: null, error: "Mise à jour de l'application requise" });
      return;
    }

    const lastPageCarcasse = pageCarcasses.at(-1);
    const nextCursor = lastPageCarcasse
      ? {
          updatedAt: String(new Date(lastPageCarcasse.updated_at).getTime()),
          id: lastPageCarcasse.zacharie_carcasse_id,
        }
      : null;
    // hors du périmètre du rôle, une carcasse de CCG est servie sans son statut, en lecture seule
    const ccgOnlyIds = await getCcgOnlyCarcasseIds(req.user, userEntityIds, ccgIds, pageCarcasses);
    const carcasses = pageCarcasses.filter((carcasse) => !ccgOnlyIds.has(carcasse.zacharie_carcasse_id));
    const ccgCarcasses = pageCarcasses.filter((carcasse) => ccgOnlyIds.has(carcasse.zacharie_carcasse_id));

    const feiNumeros = new Set<string>();
    const carcassesIds = new Set<string>();
    const userIds = new Set<string>();
    const entityIds = new Set<string>();

    // Seulement les utilisateurs que le serveur a contrôlés : les colonnes current/next/prev_owner_user_id
    // viennent du client sans contrôle, elles exposeraient les coordonnées de n'importe quel utilisateur.
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

    const ccgFeiNumeros = new Set(ccgCarcasses.map((carcasse) => carcasse.fei_numero));
    const [feisWithCarcasses, emptyFeis, allCarcassesIntermediaires, carcasseModifRequests, ccgFeis] =
      await Promise.all([
        prisma.fei.findMany({ where: { numero: { in: [...feiNumeros].filter(Boolean) } } }),
        isFirstPage ? prisma.fei.findMany({ where: emptyFeisWhere }) : [],
        prisma.carcasseIntermediaire.findMany({
          where: {
            zacharie_carcasse_id: { in: [...carcassesIds, ...ccgOnlyIds].filter(Boolean) },
          },
        }),
        prisma.carcasseModificationRequest.findMany({
          where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
        }),
        ccgFeiNumeros.size ? prisma.fei.findMany({ where: { numero: { in: [...ccgFeiNumeros] } } }) : [],
      ]);
    const feiNumerosServies = new Set([...feisWithCarcasses, ...emptyFeis].map((fei) => fei.numero));
    const feis = [
      ...feisWithCarcasses,
      ...emptyFeis,
      ...ccgFeis.filter((fei) => !feiNumerosServies.has(fei.numero)),
    ];
    const carcassesIntermediaires = allCarcassesIntermediaires.filter(
      (intermediaire) => !ccgOnlyIds.has(intermediaire.zacharie_carcasse_id)
    );

    const ccgIntermediairesByCarcasseId: Record<string, typeof allCarcassesIntermediaires> = {};
    for (const intermediaire of allCarcassesIntermediaires) {
      if (!ccgOnlyIds.has(intermediaire.zacharie_carcasse_id)) continue;
      (ccgIntermediairesByCarcasseId[intermediaire.zacharie_carcasse_id] ??= []).push(intermediaire);
    }
    const ccgCarcassesIntermediaires: typeof allCarcassesIntermediaires = [];
    for (const carcasse of ccgCarcasses) {
      ccgCarcassesIntermediaires.push(
        ...getCcgIntermediaires(
          carcasse,
          ccgIntermediairesByCarcasseId[carcasse.zacharie_carcasse_id] ?? [],
          ccgIds
        )
      );
      if (carcasse.examinateur_initial_user_id) userIds.add(carcasse.examinateur_initial_user_id);
      if (carcasse.premier_detenteur_user_id) userIds.add(carcasse.premier_detenteur_user_id);
      if (carcasse.created_by_user_id) userIds.add(carcasse.created_by_user_id);
      if (carcasse.premier_detenteur_entity_id) entityIds.add(carcasse.premier_detenteur_entity_id);
      if (carcasse.premier_detenteur_depot_entity_id)
        entityIds.add(carcasse.premier_detenteur_depot_entity_id);
      if (carcasse.premier_detenteur_prochain_detenteur_id_cache)
        entityIds.add(carcasse.premier_detenteur_prochain_detenteur_id_cache);
    }
    for (const intermediaire of ccgCarcassesIntermediaires) {
      if (intermediaire.deleted_at) continue;
      userIds.add(intermediaire.intermediaire_user_id);
      entityIds.add(intermediaire.intermediaire_entity_id);
      if (intermediaire.intermediaire_depot_entity_id)
        entityIds.add(intermediaire.intermediaire_depot_entity_id);
    }

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
        carcasses: [...carcasses, ...ccgCarcasses.map(redactCarcasseForCcg)],
        feis,
        users,
        entities,
        carcassesIntermediaires: [...carcassesIntermediaires, ...ccgCarcassesIntermediaires],
        carcasseModifRequests,
        ccgEntityIds: ccgIds,
        ccgCarcasseIds: [...ccgOnlyIds],
        nextCursor,
        hasMore,
        fullReload,
        reloadVersion: req.user.carcasses_reload_version,
      },
      error: '',
    });
  })
);

// Une carcasse refusée ou manquante en amont sort du périmètre de synchro des détenteurs suivants.
const REFUSEE_OU_MANQUANTE: Prisma.CarcasseWhereInput = {
  OR: [
    { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
    { intermediaire_carcasse_manquante: true },
  ],
};

// Nombre de carcasses non supprimées du périmètre de synchro (même périmètre que GET /, sans filtre
// updated_at). Le client le compare à son store local pour remonter les écarts à Sentry.
// On renvoie aussi les carcasses refusées hors périmètre que GET /refusees/:fei_numero peut ajouter au
// store (mêmes règles : fiches et groupes de dispatch du périmètre) : le client les exclut de son compte.
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

    // carcasses des CCG dont le chasseur est propriétaire, hors de son périmètre (lecture seule)
    const ccgIds = req.user.roles.includes(UserRoles.CHASSEUR) ? await getUserAdminCcgIds(req.user.id) : [];
    const refuseesIds = new Set(refuseesHorsPerimetreIds);
    const ccgCount = ccgIds.length
      ? (
          await prisma.carcasse.findMany({
            where: {
              deleted_at: null,
              OR: [
                { premier_detenteur_depot_entity_id: { in: ccgIds } },
                { CarcasseIntermediaire: { some: { intermediaire_depot_entity_id: { in: ccgIds } } } },
              ],
              NOT: accessWhere,
            },
            select: { zacharie_carcasse_id: true },
          })
        ).filter((c) => !refuseesIds.has(c.zacharie_carcasse_id)).length
      : 0;

    res
      .status(200)
      .send({ ok: true, data: { count: count + ccgCount, refuseesHorsPerimetreIds }, error: '' });
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
