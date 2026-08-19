import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcassesGetResponse, CarcassesRefuseesResponse } from '~/types/responses';
import prisma from '~/prisma';
import {
  EntityRelationStatus,
  EntityRelationType,
  Prisma,
  TrichineResultatAnalyse,
  UserRoles,
} from '@prisma/client';
import {
  getCarcassesStakeholderUsers,
  logTrichineStatutChange,
  notifyTrichineUsers,
  TrichineNotificationType,
  TrichineObjetType,
} from '~/utils/trichine';
import { recomputeCarcasseTrichine } from '~/utils/trichine-status';
import { RequestWithUser } from '~/types/request';
import type { EntityWithUserRelation } from '~/types/entity';
import z from 'zod';
import { capture } from '~/third-parties/sentry';
import { userFeiSelect } from '~/types/user';
import { getCarcasseAccessWhereForUser } from '~/utils/carcasse-access';

const zodQuerySchema = z.object({
  page: z.string(),
  after: z.string(),
  limit: z.string(),
  withDeleted: z.string(),
});

// Périmètre d'accès aux carcasses selon le rôle : voir `~/utils/carcasse-access`. Alias local
// pour préserver les appels existants dans ce contrôleur.
const getCarcasseAccessWhere = getCarcasseAccessWhereForUser;

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
    const { page, after, limit, withDeleted } = queryResult.data;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const includeDeleted = withDeleted === 'true';
    const afterDate = Number(after) ? new Date(Number(after)) : undefined;

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
    const [users, feis, carcassesIntermediaires, carcasseModifRequests] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...userIds].filter(Boolean) } }, select: userFeiSelect }),
      prisma.fei.findMany({ where: { numero: { in: [...feiNumeros].filter(Boolean) } } }),
      prisma.carcasseIntermediaire.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
      prisma.carcasseModificationRequest.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
    ]);

    for (const intermediaire of carcassesIntermediaires) {
      entityIds.add(intermediaire.intermediaire_entity_id!);
      if (intermediaire.intermediaire_depot_entity_id) {
        entityIds.add(intermediaire.intermediaire_depot_entity_id);
      }
    }
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
      },
      error: '',
    });
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

const retirerDeFeiSchema = z.object({
  motif: z.string().min(1),
});

// Résultats trichine autorisant le retrait d'une carcasse de sa FEI (circuit court, cf doc/trichine.md §10.2)
const resultatsAutorisantRetrait: Array<TrichineResultatAnalyse | null> = [
  TrichineResultatAnalyse.POSITIF,
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
];

router.post(
  '/:zacharie_carcasse_id/retirer-de-fei',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    const bodyResult = retirerDeFeiSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Le motif du retrait est obligatoire' });
      return;
    }
    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: req.params.zacharie_carcasse_id },
      include: {
        TrichineEchantillons: { where: { deleted_at: null }, include: { TrichinePool: true } },
      },
    });
    if (!carcasse || carcasse.deleted_at) {
      res.status(404).send({ ok: false, data: null, error: 'Carcasse introuvable' });
      return;
    }
    // Circuit court : seul le 1er détenteur retire sa carcasse de la FEI
    if (carcasse.premier_detenteur_user_id !== req.user.id) {
      res
        .status(403)
        .send({ ok: false, data: null, error: "Vous n'êtes pas le premier détenteur de cette carcasse" });
      return;
    }
    if (carcasse.trichine_retire_de_fei_at) {
      res.status(400).send({ ok: false, data: null, error: 'Cette carcasse a déjà été retirée de la FEI' });
      return;
    }
    const hasUnfavorableResult = carcasse.TrichineEchantillons.some(
      (echantillon) =>
        echantillon.TrichinePool &&
        !echantillon.TrichinePool.deleted_at &&
        resultatsAutorisantRetrait.includes(echantillon.TrichinePool.resultat_analyse)
    );
    if (!hasUnfavorableResult) {
      res.status(400).send({
        ok: false,
        data: null,
        error: 'Le retrait nécessite un résultat trichine positif, non négatif ou parasite non identifié',
      });
      return;
    }

    const updatedCarcasse = await prisma.carcasse.update({
      where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
      data: {
        trichine_retire_de_fei_at: new Date(),
        trichine_retire_de_fei_motif: bodyResult.data.motif,
        trichine_retire_de_fei_user_id: req.user.id,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.CARCASSE,
      objetId: carcasse.zacharie_carcasse_id,
      ancienStatut: carcasse.trichine_action_requise,
      nouveauStatut: 'RETIREE_DE_FEI',
      userId: req.user.id,
      commentaire: bodyResult.data.motif,
    });
    await recomputeCarcasseTrichine(carcasse.zacharie_carcasse_id, req.user.id);

    // Notifier les destinataires actuels si la carcasse a déjà été cédée
    const stakeholders = await getCarcassesStakeholderUsers([carcasse]);
    await notifyTrichineUsers({
      users: stakeholders,
      type: TrichineNotificationType.CHANGEMENT_STATUT,
      objetType: TrichineObjetType.CARCASSE,
      objetId: carcasse.zacharie_carcasse_id,
      title: `Carcasse ${carcasse.numero_bracelet} retirée de sa fiche`,
      message: `Suite au résultat d'analyse trichine, la carcasse ${carcasse.numero_bracelet} a été retirée de sa fiche par le premier détenteur. Elle est impropre à la consommation et ne peut plus être commercialisée. Motif : ${bodyResult.data.motif}`,
      notificationLogAction: `TRICHINE_RETRAIT_FEI_${carcasse.zacharie_carcasse_id}`,
      excludeUserIds: [req.user.id],
    });

    res.status(200).send({ ok: true, data: { carcasse: updatedCarcasse }, error: '' });
  })
);

export default router;
