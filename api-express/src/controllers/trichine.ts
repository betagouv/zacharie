import express from 'express';
import passport from 'passport';
import z from 'zod';
import {
  EntityTypes,
  TrichineSitePrelevement,
  TrichineStatutLogistiqueFTP,
  TrichineResultatAnalyse,
  TrichineType,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import {
  getCarcassesStakeholderUsers,
  getUsersWorkingForEntity,
  logTrichineStatutChange,
  nextEchantillonReference,
  nextFTPReference,
  nextPoolReference,
  notifyTrichineUsers,
  TrichineNotificationType,
  TrichineObjetType,
  TRICHINE_MASSE_DEFAUT_COMPLEMENTAIRE,
  TRICHINE_MASSE_DEFAUT_CONFIRMATION,
  TRICHINE_MASSE_DEFAUT_INITIAL,
  userBelongsToEntity,
  validatePoolComposition,
  withReferenceRetry,
} from '~/utils/trichine';
import {
  recomputeCarcasseTrichine,
  recomputeFTPTrichine,
  recomputePoolTrichine,
} from '~/utils/trichine-status';

const router: express.Router = express.Router();

/**
 * Routes émetteur (1er détenteur en circuit court, SVI en circuit agréé).
 * Les routes laboratoire (LVD/LNR) sont dans controllers/laboratoire.ts.
 */

function sendError(res: express.Response, status: number, error: string) {
  res.status(status).send({ ok: false, data: null, error });
}

// Émetteurs trichine : 1er détenteur (rôle CHASSEUR) en circuit court, SVI en circuit agréé
function isEmitter(req: RequestWithUser): boolean {
  return req.user.roles.includes(UserRoles.CHASSEUR) || req.user.roles.includes(UserRoles.SVI);
}

function guardEmitter(req: RequestWithUser, res: express.Response): boolean {
  if (!req.user.activated) {
    sendError(res, 400, "Le compte n'est pas activé");
    return false;
  }
  if (!isEmitter(req)) {
    sendError(res, 403, "Vous n'avez pas les droits pour effectuer cette action");
    return false;
  }
  return true;
}

const masseDefautParType: Record<TrichineType, number> = {
  [TrichineType.INITIAL]: TRICHINE_MASSE_DEFAUT_INITIAL,
  [TrichineType.COMPLEMENTAIRE]: TRICHINE_MASSE_DEFAUT_COMPLEMENTAIRE,
  [TrichineType.CONFIRMATION]: TRICHINE_MASSE_DEFAUT_CONFIRMATION,
};

// Circuit agréé : un SVI n'agit que sur les carcasses assignées à son service d'inspection
async function sviHasAccessToCarcasse(
  userId: string,
  carcasse: { svi_entity_id: string | null }
): Promise<boolean> {
  if (!carcasse.svi_entity_id) return false;
  return userBelongsToEntity(userId, carcasse.svi_entity_id);
}

/* -------------------------------------------------------------------------- */
/* Échantillons                                                                */
/* -------------------------------------------------------------------------- */

const echantillonSchema = z.object({
  zacharie_carcasse_id: z.string().min(1),
  site_prelevement: z.enum(Object.values(TrichineSitePrelevement) as [TrichineSitePrelevement]),
  type: z.enum(Object.values(TrichineType) as [TrichineType]).optional(),
  masse_grammes: z.number().int().positive().optional(),
  date_prelevement: z.coerce.date().optional(),
  preleve_par_entity_id: z.string().optional(),
  commentaire: z.string().optional(),
});

router.post(
  '/echantillon',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = echantillonSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: body.zacharie_carcasse_id },
    });
    if (!carcasse || carcasse.deleted_at) {
      return sendError(res, 404, 'Carcasse introuvable');
    }
    if (carcasse.espece !== 'Sanglier') {
      return sendError(res, 400, 'La recherche de trichine ne concerne que les sangliers');
    }
    if (carcasse.trichine_retire_de_fei_at) {
      return sendError(res, 400, 'Cette carcasse a été retirée de la FEI');
    }
    // Circuit court : seul le 1er détenteur prélève ; circuit agréé : le SVI assigné à la carcasse
    if (req.user.roles.includes(UserRoles.SVI)) {
      if (!(await sviHasAccessToCarcasse(req.user.id, carcasse))) {
        return sendError(res, 403, "Cette carcasse n'est pas assignée à votre service d'inspection");
      }
    } else if (carcasse.premier_detenteur_user_id !== req.user.id) {
      return sendError(res, 403, "Vous n'êtes pas le premier détenteur de cette carcasse");
    }
    if (body.preleve_par_entity_id && !(await userBelongsToEntity(req.user.id, body.preleve_par_entity_id))) {
      return sendError(res, 403, "Vous ne faites pas partie de l'entité de prélèvement indiquée");
    }

    const type = body.type ?? TrichineType.INITIAL;
    const echantillon = await withReferenceRetry(async () =>
      prisma.trichineEchantillon.create({
        data: {
          reference_echantillon: await nextEchantillonReference(),
          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
          preleve_par_user_id: req.user.id,
          preleve_par_entity_id: body.preleve_par_entity_id ?? null,
          type,
          site_prelevement: body.site_prelevement,
          masse_grammes: body.masse_grammes ?? masseDefautParType[type],
          date_prelevement: body.date_prelevement ?? new Date(),
          commentaire: body.commentaire ?? null,
        },
      })
    );
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: echantillon.id,
      ancienStatut: null,
      nouveauStatut: echantillon.statut,
      userId: req.user.id,
      commentaire: `Création de l'échantillon ${echantillon.reference_echantillon}`,
    });
    await recomputeCarcasseTrichine(carcasse.zacharie_carcasse_id, req.user.id);

    res.status(200).send({ ok: true, data: { echantillon }, error: '' });
  })
);

router.get(
  '/echantillons',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const sansPool = req.query.sans_pool === 'true';
    const echantillons = await prisma.trichineEchantillon.findMany({
      where: {
        preleve_par_user_id: req.user.id,
        deleted_at: null,
        ...(sansPool ? { pool_id: null } : {}),
      },
      include: {
        Carcasse: {
          select: {
            zacharie_carcasse_id: true,
            numero_bracelet: true,
            espece: true,
            date_mise_a_mort: true,
            Fei: { select: { commune_mise_a_mort: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { echantillons }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Pools                                                                       */
/* -------------------------------------------------------------------------- */

const poolSchema = z.object({
  echantillon_ids: z.array(z.string().min(1)).min(1),
  pool_parent_id: z.string().optional(),
  date_constitution: z.coerce.date().optional(),
  cree_par_entity_id: z.string().optional(),
  commentaire: z.string().optional(),
});

router.post(
  '/pool',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = poolSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const echantillons = await prisma.trichineEchantillon.findMany({
      where: { id: { in: body.echantillon_ids } },
      include: { Carcasse: { select: { premier_detenteur_user_id: true } } },
    });
    if (echantillons.length !== body.echantillon_ids.length) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    if (echantillons.some((echantillon) => echantillon.preleve_par_user_id !== req.user.id)) {
      return sendError(res, 403, "Un des échantillons n'a pas été prélevé par vous");
    }
    // Circuit court : pas de mix de 1ers détenteurs (uniquement le SVI peut mixer en circuit agréé)
    if (!req.user.roles.includes(UserRoles.SVI)) {
      if (echantillons.some((e) => e.Carcasse.premier_detenteur_user_id !== req.user.id)) {
        return sendError(res, 403, 'Toutes les carcasses du pool doivent être à votre nom');
      }
    }
    if (body.cree_par_entity_id && !(await userBelongsToEntity(req.user.id, body.cree_par_entity_id))) {
      return sendError(res, 403, "Vous ne faites pas partie de l'entité indiquée");
    }

    let parent: {
      id: string;
      pool_parent_id: string | null;
      resultat_analyse: TrichineResultatAnalyse | null;
      carcasseIds: string[];
      parentHasGrandParent: boolean;
    } | null = null;
    if (body.pool_parent_id) {
      const parentPool = await prisma.trichinePool.findUnique({
        where: { id: body.pool_parent_id },
        include: {
          PoolParent: { select: { pool_parent_id: true } },
          TrichineEchantillons: { where: { deleted_at: null }, select: { zacharie_carcasse_id: true } },
        },
      });
      if (!parentPool || parentPool.deleted_at) {
        return sendError(res, 404, 'Pool parent introuvable');
      }
      if (parentPool.cree_par_user_id !== req.user.id) {
        return sendError(res, 403, "Le pool parent n'a pas été créé par vous");
      }
      parent = {
        id: parentPool.id,
        pool_parent_id: parentPool.pool_parent_id,
        resultat_analyse: parentPool.resultat_analyse,
        carcasseIds: parentPool.TrichineEchantillons.map((e) => e.zacharie_carcasse_id),
        parentHasGrandParent: !!parentPool.PoolParent?.pool_parent_id,
      };
    }

    const compositionError = validatePoolComposition({ echantillons, parent });
    if (compositionError) {
      return sendError(res, 400, compositionError);
    }

    const pool = await withReferenceRetry(async () =>
      prisma.trichinePool.create({
        data: {
          reference_pool: await nextPoolReference(),
          cree_par_user_id: req.user.id,
          cree_par_entity_id: body.cree_par_entity_id ?? null,
          type: parent ? TrichineType.COMPLEMENTAIRE : TrichineType.INITIAL,
          pool_parent_id: parent?.id ?? null,
          date_constitution: body.date_constitution ?? new Date(),
          commentaire: body.commentaire ?? null,
        },
      })
    );
    await prisma.trichineEchantillon.updateMany({
      where: { id: { in: body.echantillon_ids } },
      data: { pool_id: pool.id },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: null,
      nouveauStatut: pool.statut,
      userId: req.user.id,
      commentaire: `Création du pool ${pool.reference_pool} (${echantillons.length} échantillon(s))`,
    });
    await recomputePoolTrichine(pool.id, req.user.id);

    res.status(200).send({ ok: true, data: { pool }, error: '' });
  })
);

router.get(
  '/pools',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const pools = await prisma.trichinePool.findMany({
      where: { cree_par_user_id: req.user.id, deleted_at: null },
      include: {
        TrichineEchantillons: { where: { deleted_at: null } },
        TrichinePoolFTPs: { include: { TrichineFTP: true } },
        PoolsFilles: { where: { deleted_at: null } },
        Documents: { where: { deleted_at: null } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { pools }, error: '' });
  })
);

const renoncerSchema = z.object({
  commentaire: z.string().optional(),
});

// Circuit court uniquement : renoncement aux analyses de 2e intention après pool douteux.
// Toutes les carcasses du pool sont retirées de leur FEI avec un motif automatique.
router.post(
  '/pool/:pool_id/renoncer-2e-intention',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = renoncerSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const pool = await prisma.trichinePool.findUnique({
      where: { id: req.params.pool_id },
      include: {
        TrichineEchantillons: {
          where: { deleted_at: null },
          include: {
            Carcasse: {
              select: {
                zacharie_carcasse_id: true,
                numero_bracelet: true,
                trichine_action_requise: true,
                trichine_retire_de_fei_at: true,
                premier_detenteur_user_id: true,
                current_owner_user_id: true,
                current_owner_entity_id: true,
              },
            },
          },
        },
      },
    });
    if (!pool || pool.deleted_at) {
      return sendError(res, 404, 'Pool introuvable');
    }
    if (pool.cree_par_user_id !== req.user.id) {
      return sendError(res, 403, "Ce pool n'a pas été créé par vous");
    }
    if (pool.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX) {
      return sendError(res, 400, 'Le renoncement ne concerne que les pools au résultat douteux');
    }

    const motif = `Renoncement aux analyses de 2e intention — pool ${pool.reference_pool}`;
    const now = new Date();
    const carcasses = [
      ...new Map(pool.TrichineEchantillons.map((e) => [e.zacharie_carcasse_id, e.Carcasse])).values(),
    ];
    for (const carcasse of carcasses) {
      if (carcasse.trichine_retire_de_fei_at) continue;
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
        data: {
          trichine_retire_de_fei_at: now,
          trichine_retire_de_fei_motif: motif,
          trichine_retire_de_fei_user_id: req.user.id,
        },
      });
      await logTrichineStatutChange({
        objetType: TrichineObjetType.CARCASSE,
        objetId: carcasse.zacharie_carcasse_id,
        ancienStatut: carcasse.trichine_action_requise,
        nouveauStatut: 'RETIREE_DE_FEI',
        userId: req.user.id,
        commentaire: motif,
      });
      await recomputeCarcasseTrichine(carcasse.zacharie_carcasse_id, req.user.id);
    }

    const stakeholders = await getCarcassesStakeholderUsers(carcasses);
    await notifyTrichineUsers({
      users: stakeholders,
      type: TrichineNotificationType.CHANGEMENT_STATUT,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Carcasses retirées de leur fiche — pool ${pool.reference_pool}`,
      message: `Suite au résultat douteux du pool ${pool.reference_pool}, le premier détenteur a renoncé aux analyses de 2e intention. Les carcasses concernées sont retirées de leur fiche et ne peuvent plus être commercialisées.`,
      notificationLogAction: `TRICHINE_RENONCEMENT_${pool.reference_pool}`,
      excludeUserIds: [req.user.id],
    });

    res.status(200).send({ ok: true, data: { retirees: carcasses.length }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* FTP                                                                         */
/* -------------------------------------------------------------------------- */

const ftpSchema = z.object({
  pool_ids: z.array(z.string().min(1)).min(1),
  destinataire_entity_id: z.string().min(1),
  expediteur_entity_id: z.string().optional(),
  mode_transport: z.string().optional(),
  commentaire: z.string().optional(),
});

router.post(
  '/ftp',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = ftpSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const destinataire = await prisma.entity.findUnique({ where: { id: body.destinataire_entity_id } });
    if (!destinataire || destinataire.deleted_at || destinataire.type !== EntityTypes.LABORATOIRE) {
      return sendError(res, 400, "Le destinataire n'est pas un laboratoire");
    }
    if (body.expediteur_entity_id && !(await userBelongsToEntity(req.user.id, body.expediteur_entity_id))) {
      return sendError(res, 403, "Vous ne faites pas partie de l'entité expéditrice indiquée");
    }

    const pools = await prisma.trichinePool.findMany({
      where: { id: { in: body.pool_ids } },
      include: { TrichinePoolFTPs: { include: { TrichineFTP: { select: { deleted_at: true } } } } },
    });
    if (pools.length !== body.pool_ids.length) {
      return sendError(res, 404, 'Pool introuvable');
    }
    if (pools.some((pool) => pool.deleted_at)) {
      return sendError(res, 400, 'Un des pools a été supprimé');
    }
    if (pools.some((pool) => pool.cree_par_user_id !== req.user.id)) {
      return sendError(res, 403, "Un des pools n'a pas été créé par vous");
    }
    if (pools.some((pool) => pool.TrichinePoolFTPs.some((link) => !link.TrichineFTP.deleted_at))) {
      return sendError(res, 400, 'Un des pools est déjà rattaché à une FTP');
    }

    const ftp = await withReferenceRetry(async () =>
      prisma.trichineFTP.create({
        data: {
          numero_fiche: await nextFTPReference(),
          expediteur_user_id: req.user.id,
          expediteur_entity_id: body.expediteur_entity_id ?? null,
          destinataire_entity_id: destinataire.id,
          mode_transport: body.mode_transport ?? null,
          commentaire: body.commentaire ?? null,
        },
      })
    );
    await prisma.trichinePoolFTP.createMany({
      data: body.pool_ids.map((pool_id) => ({ pool_id, ftp_id: ftp.id })),
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: null,
      nouveauStatut: ftp.statut_logistique,
      userId: req.user.id,
      commentaire: `Création de la FTP ${ftp.numero_fiche} (${pools.length} pool(s))`,
    });

    res.status(200).send({ ok: true, data: { ftp }, error: '' });
  })
);

const envoyerSchema = z.object({
  date_envoi: z.coerce.date().optional(),
});

router.post(
  '/ftp/:ftp_id/envoyer',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = envoyerSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: { TrichinePoolFTPs: { include: { TrichinePool: true } }, DestinataireEntity: true },
    });
    if (!ftp || ftp.deleted_at) {
      return sendError(res, 404, 'FTP introuvable');
    }
    if (ftp.expediteur_user_id !== req.user.id) {
      return sendError(res, 403, "Cette FTP n'a pas été créée par vous");
    }
    if (ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON) {
      return sendError(res, 400, 'Cette FTP a déjà été envoyée');
    }

    const updatedFtp = await prisma.trichineFTP.update({
      where: { id: ftp.id },
      data: {
        statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
        date_envoi: bodyResult.data.date_envoi ?? new Date(),
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: ftp.statut_logistique,
      nouveauStatut: updatedFtp.statut_logistique,
      userId: req.user.id,
      commentaire: 'statut_logistique',
    });
    // Les pools (et leurs échantillons / carcasses) passent en cours d'analyses
    for (const { pool_id } of ftp.TrichinePoolFTPs) {
      await recomputePoolTrichine(pool_id, req.user.id);
    }
    // Statut analytique de la FTP (EN_COURS_ANALYSES) + historique
    await recomputeFTPTrichine(ftp.id, req.user.id);

    const laboUsers = await getUsersWorkingForEntity(ftp.destinataire_entity_id);
    await notifyTrichineUsers({
      users: laboUsers,
      type: TrichineNotificationType.FTP_RECUE,
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      title: `Nouvelle FTP ${ftp.numero_fiche}`,
      message: `${req.user.prenom} ${req.user.nom_de_famille} vous a transmis la fiche de transmission des prélèvements ${ftp.numero_fiche} (${ftp.TrichinePoolFTPs.length} pool(s)). Connectez-vous à Zacharie pour la traiter.`,
      notificationLogAction: `TRICHINE_FTP_ENVOYEE_${ftp.numero_fiche}`,
    });

    res.status(200).send({ ok: true, data: { ftp: updatedFtp }, error: '' });
  })
);

router.get(
  '/ftps',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftps = await prisma.trichineFTP.findMany({
      where: { expediteur_user_id: req.user.id, deleted_at: null },
      include: {
        DestinataireEntity: { select: { id: true, nom_d_usage: true, raison_sociale: true, is_lnr: true } },
        TrichinePoolFTPs: { include: { TrichinePool: true } },
        Documents: { where: { deleted_at: null } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { ftps }, error: '' });
  })
);

router.get(
  '/ftp/:ftp_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: {
        DestinataireEntity: { select: { id: true, nom_d_usage: true, raison_sociale: true, is_lnr: true } },
        TrichinePoolFTPs: {
          include: {
            TrichinePool: {
              include: {
                TrichineEchantillons: { where: { deleted_at: null } },
                Documents: { where: { deleted_at: null } },
              },
            },
          },
        },
        Documents: { where: { deleted_at: null } },
      },
    });
    if (!ftp || ftp.deleted_at || ftp.expediteur_user_id !== req.user.id) {
      return sendError(res, 404, 'FTP introuvable');
    }
    res.status(200).send({ ok: true, data: { ftp }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Vue carcasse (émetteur)                                                     */
/* -------------------------------------------------------------------------- */

router.get(
  '/carcasse/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: req.params.zacharie_carcasse_id },
      select: {
        zacharie_carcasse_id: true,
        premier_detenteur_user_id: true,
        examinateur_initial_user_id: true,
        svi_entity_id: true,
        trichine_action_requise: true,
        trichine_retire_de_fei_at: true,
        trichine_retire_de_fei_motif: true,
        TrichineEchantillons: {
          where: { deleted_at: null },
          include: {
            TrichinePool: {
              include: { TrichinePoolFTPs: { include: { TrichineFTP: true } } },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!carcasse) {
      return sendError(res, 404, 'Carcasse introuvable');
    }
    let canView =
      carcasse.premier_detenteur_user_id === req.user.id ||
      carcasse.examinateur_initial_user_id === req.user.id;
    if (!canView && req.user.roles.includes(UserRoles.SVI)) {
      canView = await sviHasAccessToCarcasse(req.user.id, carcasse);
    }
    if (!canView) {
      return sendError(res, 403, "Vous n'avez pas accès à cette carcasse");
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.CARCASSE, objet_id: carcasse.zacharie_carcasse_id },
      orderBy: { date_changement: 'desc' },
    });
    res.status(200).send({ ok: true, data: { carcasse, historique }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Annuaire des laboratoires (pour la création de FTP)                         */
/* -------------------------------------------------------------------------- */

router.get(
  '/laboratoires',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    // LVD uniquement : le LNR ne reçoit que les FTP générées automatiquement après un résultat douteux
    const laboratoires = await prisma.entity.findMany({
      where: { type: EntityTypes.LABORATOIRE, is_lnr: false, deleted_at: null },
      select: {
        id: true,
        nom_d_usage: true,
        raison_sociale: true,
        address_ligne_1: true,
        code_postal: true,
        ville: true,
      },
      orderBy: { nom_d_usage: 'asc' },
    });
    res.status(200).send({ ok: true, data: { laboratoires }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

router.get(
  '/notifications',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const notifications = await prisma.trichineNotification.findMany({
      where: { utilisateur_id: req.user.id },
      orderBy: { date_creation: 'desc' },
      take: 100,
    });
    res.status(200).send({ ok: true, data: { notifications }, error: '' });
  })
);

router.post(
  '/notifications/:notification_id/lue',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const notification = await prisma.trichineNotification.findUnique({
      where: { id: req.params.notification_id },
    });
    if (!notification || notification.utilisateur_id !== req.user.id) {
      return sendError(res, 404, 'Notification introuvable');
    }
    const updated = await prisma.trichineNotification.update({
      where: { id: notification.id },
      data: { lu: true, date_lecture: notification.date_lecture ?? new Date() },
    });
    res.status(200).send({ ok: true, data: { notification: updated }, error: '' });
  })
);

export default router;
