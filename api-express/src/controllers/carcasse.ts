import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcassesGetResponse } from '~/types/responses';
import prisma from '~/prisma';
import {
  EntityRelationStatus,
  EntityRelationType,
  FeiOwnerRole,
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

const zodQuerySchema = z.object({
  page: z.string(),
  after: z.string(),
  limit: z.string(),
  withDeleted: z.string(),
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
    const { page, after, limit, withDeleted } = queryResult.data;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const includeDeleted = withDeleted === 'true';
    const afterDate = Number(after) ? new Date(Number(after)) : undefined;

    // Base query conditions
    let where: Prisma.CarcasseWhereInput = {};

    // Pre-fetch entity IDs the user works for (used in carcasse-level queries)
    const userEntityRelations = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: req.user.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      },
      select: { entity_id: true },
    });
    const userEntityIds = userEntityRelations.map((r) => r.entity_id);

    if (req.user.roles.includes(UserRoles.SVI)) {
      where = {
        svi_assigned_at: { not: null },
        OR: [
          {
            svi_entity_id: { in: userEntityIds },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
          },
        ],
      };
    } else if (req.user.roles.includes(UserRoles.CHASSEUR)) {
      where = {
        OR: [
          {
            premier_detenteur_user_id: req.user.id,
          },
          {
            examinateur_initial_user_id: req.user.id,
          },
          // Désignation du premier détenteur (asso) : on n'expose la fiche aux membres de
          // l'entité qu'une fois la fiche réellement transmise (sortie de l'examinateur initial),
          // pas dès la simple désignation en cours de préparation.
          {
            premier_detenteur_entity_id: { in: userEntityIds },
            current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
            current_owner_role: { not: FeiOwnerRole.EXAMINATEUR_INITIAL },
          },
          {
            prev_owner_entity_id: { in: userEntityIds },
          },
          {
            current_owner_entity_id: { in: userEntityIds },
          },
          {
            next_owner_user_id: req.user.id,
          },
          {
            prev_owner_user_id: req.user.id,
          },
          {
            current_owner_user_id: req.user.id,
          },
        ],
      };
    } else if (
      req.user.roles.includes(UserRoles.ETG) ||
      req.user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
      req.user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) ||
      req.user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) ||
      req.user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) ||
      req.user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) ||
      req.user.roles.includes(UserRoles.CONSOMMATEUR_FINAL)
    ) {
      where = {
        OR: [
          {
            CarcasseIntermediaire: {
              some: {
                intermediaire_entity_id: { in: userEntityIds },
              },
            },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
          },
          {
            current_owner_entity_id: { in: userEntityIds },
          },
        ],
      };
    } else {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({
        ok: false,
        data: null,
        error: "Vous n'avez pas les permissions.",
      });
      return;
    }

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
