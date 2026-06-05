import express from 'express';
import passport from 'passport';
import z from 'zod';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import { capture } from '~/third-parties/sentry';
import {
  getCarcassesStakeholderUsers,
  getUsersWorkingForEntity,
  logTrichineStatutChange,
  nextFTPReference,
  notifyTrichineUsers,
  trichineNotifiableUserSelect,
  TrichineDocumentType,
  TrichineNotificationType,
  TrichineObjetType,
  withReferenceRetry,
  type TrichineNotifiableUser,
} from '~/utils/trichine';
import { isTerminalResult, recomputeFTPTrichine, recomputePoolTrichine } from '~/utils/trichine-status';

const router: express.Router = express.Router();

/**
 * Routes laboratoire (LVD et LNR, rôle LABORATOIRE).
 * Visibilité stricte (cf doc/trichine.md §10.2) : ces endpoints construisent une
 * projection côté serveur — carcasse minimale + émetteur — sans réutiliser /carcasse/:id.
 */

function sendError(res: express.Response, status: number, error: string) {
  res.status(status).send({ ok: false, data: null, error });
}

type LaboContext = {
  entityIds: string[];
  // true si l'utilisateur travaille pour le LNR
  isLnr: boolean;
};

async function guardLabo(req: RequestWithUser, res: express.Response): Promise<LaboContext | null> {
  if (!req.user.activated) {
    sendError(res, 400, "Le compte n'est pas activé");
    return null;
  }
  if (!req.user.roles.includes(UserRoles.LABORATOIRE)) {
    sendError(res, 403, "Vous n'avez pas les droits pour effectuer cette action");
    return null;
  }
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: req.user.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.LABORATOIRE, deleted_at: null },
    },
    include: { EntityRelatedWithUser: { select: { id: true, is_lnr: true } } },
  });
  if (!relations.length) {
    sendError(res, 403, 'Aucun laboratoire associé à votre compte');
    return null;
  }
  return {
    entityIds: relations.map((relation) => relation.EntityRelatedWithUser.id),
    isLnr: relations.some((relation) => relation.EntityRelatedWithUser.is_lnr),
  };
}

// Projection stricte : seules données carcasse visibles par le labo
// (la commune de mise à mort est portée par la FEI)
const carcasseLaboSelect = {
  numero_bracelet: true,
  espece: true,
  date_mise_a_mort: true,
  Fei: { select: { commune_mise_a_mort: true } },
} as const;

const echantillonLaboInclude = {
  Carcasse: { select: carcasseLaboSelect },
} as const;

// Émetteur : nom + contact uniquement (facturation / relance)
const expediteurLaboSelect = {
  ExpediteurUser: {
    select: { prenom: true, nom_de_famille: true, email: true, telephone: true },
  },
  ExpediteurEntity: {
    select: {
      nom_d_usage: true,
      raison_sociale: true,
      address_ligne_1: true,
      code_postal: true,
      ville: true,
    },
  },
} as const;

async function getFtpEmitterUsers(ftp: {
  expediteur_user_id: string;
  expediteur_entity_id: string | null;
}): Promise<TrichineNotifiableUser[]> {
  const byId = new Map<string, TrichineNotifiableUser>();
  const user = await prisma.user.findUnique({
    where: { id: ftp.expediteur_user_id },
    select: trichineNotifiableUserSelect,
  });
  if (user) byId.set(user.id, user);
  if (ftp.expediteur_entity_id) {
    for (const entityUser of await getUsersWorkingForEntity(ftp.expediteur_entity_id)) {
      byId.set(entityUser.id, entityUser);
    }
  }
  return [...byId.values()];
}

/**
 * Retrouve le pool + la FTP par laquelle il est arrivé dans un des laboratoires
 * de l'utilisateur (la plus récente, hors brouillons).
 */
async function findPoolForLabo(poolId: string, context: LaboContext) {
  const pool = await prisma.trichinePool.findUnique({
    where: { id: poolId },
    include: {
      TrichineEchantillons: {
        where: { deleted_at: null },
        include: {
          Carcasse: {
            select: {
              zacharie_carcasse_id: true,
              premier_detenteur_user_id: true,
              current_owner_user_id: true,
              current_owner_entity_id: true,
            },
          },
        },
      },
      TrichinePoolFTPs: {
        include: {
          TrichineFTP: {
            include: {
              DestinataireEntity: {
                select: { id: true, is_lnr: true, nom_d_usage: true, raison_sociale: true },
              },
            },
          },
        },
        orderBy: { date_ajout: 'desc' },
      },
    },
  });
  if (!pool || pool.deleted_at) return null;
  const link = pool.TrichinePoolFTPs.find(
    ({ TrichineFTP: ftp }) =>
      !ftp.deleted_at &&
      ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON &&
      context.entityIds.includes(ftp.destinataire_entity_id)
  );
  if (!link) return null;
  return { pool, ftp: link.TrichineFTP };
}

/**
 * Recompute le pool + TOUTES les FTP qui le référencent : un pool peut être dans
 * deux FTP successives (émetteur → LVD puis LVD → LNR), et la FTP d'origine doit
 * aussi se clôturer quand le LNR rend son résultat.
 */
async function recomputePoolAndLinkedFTPs(poolId: string, userId: string) {
  await recomputePoolTrichine(poolId, userId);
  const links = await prisma.trichinePoolFTP.findMany({ where: { pool_id: poolId } });
  for (const link of links) {
    await recomputeFTPTrichine(link.ftp_id, userId);
  }
}

/* -------------------------------------------------------------------------- */
/* FTP reçues                                                                  */
/* -------------------------------------------------------------------------- */

router.get(
  '/ftp',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const ftps = await prisma.trichineFTP.findMany({
      where: {
        destinataire_entity_id: { in: context.entityIds },
        statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
        deleted_at: null,
      },
      include: {
        ...expediteurLaboSelect,
        TrichinePoolFTPs: { include: { TrichinePool: true } },
      },
      orderBy: { date_envoi: 'desc' },
    });
    res.status(200).send({ ok: true, data: { ftps }, error: '' });
  })
);

router.get(
  '/ftp/:ftp_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: {
        ...expediteurLaboSelect,
        TrichinePoolFTPs: {
          include: {
            TrichinePool: {
              include: {
                TrichineEchantillons: { where: { deleted_at: null }, include: echantillonLaboInclude },
                Documents: { where: { deleted_at: null } },
              },
            },
          },
        },
        Documents: { where: { deleted_at: null } },
      },
    });
    if (
      !ftp ||
      ftp.deleted_at ||
      ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON ||
      !context.entityIds.includes(ftp.destinataire_entity_id)
    ) {
      return sendError(res, 404, 'FTP introuvable');
    }
    res.status(200).send({ ok: true, data: { ftp }, error: '' });
  })
);

const receptionSchema = z.object({
  date_reception: z.coerce.date().optional(),
});

router.post(
  '/ftp/:ftp_id/reception',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = receptionSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: { TrichinePoolFTPs: true },
    });
    if (!ftp || ftp.deleted_at || !context.entityIds.includes(ftp.destinataire_entity_id)) {
      return sendError(res, 404, 'FTP introuvable');
    }
    if (ftp.statut_logistique !== TrichineStatutLogistiqueFTP.ENVOYEE) {
      return sendError(res, 400, "Cette FTP n'est pas en attente de réception");
    }

    const dateReception = bodyResult.data.date_reception ?? new Date();
    const updatedFtp = await prisma.trichineFTP.update({
      where: { id: ftp.id },
      data: { statut_logistique: TrichineStatutLogistiqueFTP.RECUE },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: ftp.statut_logistique,
      nouveauStatut: updatedFtp.statut_logistique,
      userId: req.user.id,
      commentaire: 'statut_logistique',
    });
    await prisma.trichinePool.updateMany({
      where: { id: { in: ftp.TrichinePoolFTPs.map((link) => link.pool_id) }, date_reception: null },
      data: { date_reception: dateReception },
    });

    const emitterUsers = await getFtpEmitterUsers(ftp);
    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.CHANGEMENT_STATUT,
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      title: `FTP ${ftp.numero_fiche} réceptionnée`,
      message: `Votre fiche de transmission des prélèvements ${ftp.numero_fiche} a été réceptionnée par le laboratoire. Les analyses vont démarrer.`,
      notificationLogAction: `TRICHINE_FTP_RECUE_${ftp.numero_fiche}`,
    });

    res.status(200).send({ ok: true, data: { ftp: updatedFtp }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Saisie des résultats                                                        */
/* -------------------------------------------------------------------------- */

const LVD_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NEGATIF,
  TrichineResultatAnalyse.DOUTEUX,
];
const LNR_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];

const resultatSchema = z.object({
  resultat_analyse: z.enum(Object.values(TrichineResultatAnalyse) as [TrichineResultatAnalyse]),
  parasite_identifie: z.string().optional(),
  date_debut_analyse: z.coerce.date().optional(),
  date_fin_analyse: z.coerce.date().optional(),
  reference_labo: z.string().optional(),
  commentaire: z.string().optional(),
});

router.post(
  '/pool/:pool_id/resultat',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = resultatSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const found = await findPoolForLabo(req.params.pool_id, context);
    if (!found) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const { pool, ftp } = found;
    const isLnr = ftp.DestinataireEntity.is_lnr;

    const allowed = isLnr ? LNR_RESULTS : LVD_RESULTS;
    if (!allowed.includes(body.resultat_analyse)) {
      return sendError(res, 400, `Résultat non autorisé pour votre laboratoire : ${body.resultat_analyse}`);
    }
    if (body.resultat_analyse === TrichineResultatAnalyse.NON_NEGATIF && !body.parasite_identifie) {
      return sendError(res, 400, 'Le parasite identifié est obligatoire pour un résultat non négatif');
    }
    // Seul le LNR peut écraser un résultat DOUTEUX (confirmation) ; tout autre résultat est définitif
    if (pool.resultat_analyse && !(pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX && isLnr)) {
      return sendError(res, 400, 'Un résultat a déjà été saisi pour ce pool');
    }

    await prisma.trichinePool.update({
      where: { id: pool.id },
      data: {
        resultat_analyse: body.resultat_analyse,
        parasite_identifie: body.parasite_identifie ?? null,
        date_debut_analyse: body.date_debut_analyse ?? pool.date_debut_analyse,
        date_fin_analyse: body.date_fin_analyse ?? new Date(),
        reference_labo: body.reference_labo ?? pool.reference_labo,
        commentaire: body.commentaire ?? pool.commentaire,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: pool.resultat_analyse,
      nouveauStatut: body.resultat_analyse,
      userId: req.user.id,
      commentaire: 'resultat_analyse',
    });
    await recomputePoolAndLinkedFTPs(pool.id, req.user.id);

    const emitterUsers = await getFtpEmitterUsers(ftp);
    const carcasses = pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse);
    const stakeholders = await getCarcassesStakeholderUsers(carcasses);

    if (body.resultat_analyse === TrichineResultatAnalyse.NEGATIF) {
      await notifyTrichineUsers({
        users: [...emitterUsers, ...stakeholders],
        type: TrichineNotificationType.RESULTAT_ANALYSE,
        objetType: TrichineObjetType.POOL,
        objetId: pool.id,
        title: `Résultat négatif — pool ${pool.reference_pool}`,
        message: `Le laboratoire a rendu un résultat négatif (pas de trichine) pour le pool ${pool.reference_pool}. Les carcasses associées peuvent être commercialisées.`,
        notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_NEGATIF`,
      });
    }

    if (body.resultat_analyse === TrichineResultatAnalyse.DOUTEUX) {
      // Type ré-attribué automatiquement : le pool transmis au LNR devient un pool de confirmation
      await prisma.trichinePool.update({
        where: { id: pool.id },
        data: { type: TrichineType.CONFIRMATION },
      });
      await prisma.trichineEchantillon.updateMany({
        where: { pool_id: pool.id, deleted_at: null },
        data: { type: TrichineType.CONFIRMATION },
      });

      // Génération automatique de la FTP vers le LNR
      const lnrEntity = await prisma.entity.findFirst({
        where: { type: EntityTypes.LABORATOIRE, is_lnr: true, deleted_at: null },
      });
      if (!lnrEntity) {
        capture(new Error('Trichine : aucun LNR seedé, FTP de confirmation non générée'), {
          extra: { pool_id: pool.id },
        });
      } else {
        const lnrFtp = await withReferenceRetry(async () =>
          prisma.trichineFTP.create({
            data: {
              numero_fiche: await nextFTPReference(),
              expediteur_user_id: req.user.id,
              expediteur_entity_id: ftp.destinataire_entity_id,
              destinataire_entity_id: lnrEntity.id,
              ftp_parent_id: ftp.id,
              statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
              date_envoi: new Date(),
              commentaire: `Confirmation LNR du pool ${pool.reference_pool} (résultat douteux)`,
            },
          })
        );
        await prisma.trichinePoolFTP.create({ data: { pool_id: pool.id, ftp_id: lnrFtp.id } });
        // Statut analytique de la FTP de confirmation (EN_COURS_ANALYSES)
        await recomputeFTPTrichine(lnrFtp.id, req.user.id);
        await logTrichineStatutChange({
          objetType: TrichineObjetType.FTP,
          objetId: lnrFtp.id,
          ancienStatut: null,
          nouveauStatut: lnrFtp.statut_logistique,
          userId: req.user.id,
          commentaire: `FTP générée automatiquement vers le LNR pour le pool ${pool.reference_pool}`,
        });
        const lnrUsers = await getUsersWorkingForEntity(lnrEntity.id);
        await notifyTrichineUsers({
          users: lnrUsers,
          type: TrichineNotificationType.FTP_RECUE,
          objetType: TrichineObjetType.FTP,
          objetId: lnrFtp.id,
          title: `Pool douteux à confirmer — FTP ${lnrFtp.numero_fiche}`,
          message: `Un laboratoire vous a transmis le pool ${pool.reference_pool} (résultat douteux) pour confirmation via la FTP ${lnrFtp.numero_fiche}.`,
          notificationLogAction: `TRICHINE_FTP_ENVOYEE_${lnrFtp.numero_fiche}`,
        });
      }

      await notifyTrichineUsers({
        users: emitterUsers,
        type: TrichineNotificationType.RESULTAT_ANALYSE,
        objetType: TrichineObjetType.POOL,
        objetId: pool.id,
        title: `Résultat douteux — pool ${pool.reference_pool}`,
        message: `Le laboratoire a détecté une larve dans le pool ${pool.reference_pool}. Une confirmation par le LNR est en cours. Vous pouvez réaliser des prélèvements de 2e intention pour identifier la carcasse incriminée.`,
        notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_DOUTEUX`,
      });
    }

    if (LNR_RESULTS.includes(body.resultat_analyse)) {
      // Résultat de confirmation LNR : alerte au LVD (expéditeur de la FTP de confirmation)
      // + à l'émetteur initial (expéditeur de la FTP d'origine) + aux détenteurs des carcasses
      const recipients = new Map<string, TrichineNotifiableUser>();
      for (const user of emitterUsers) recipients.set(user.id, user);
      if (ftp.ftp_parent_id) {
        const parentFtp = await prisma.trichineFTP.findUnique({ where: { id: ftp.ftp_parent_id } });
        if (parentFtp) {
          for (const user of await getFtpEmitterUsers(parentFtp)) recipients.set(user.id, user);
        }
      }
      for (const user of stakeholders) recipients.set(user.id, user);

      const messages: Partial<Record<TrichineResultatAnalyse, string>> = {
        [TrichineResultatAnalyse.POSITIF]: `ALERTE SANITAIRE — Le LNR a confirmé la présence de trichine dans le pool ${pool.reference_pool}. Les carcasses concernées sont impropres à la consommation et doivent être retirées / saisies.`,
        [TrichineResultatAnalyse.NON_NEGATIF]: `Le LNR a identifié un parasite autre que la trichine (${body.parasite_identifie}) dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
        [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: `Le LNR a détecté un parasite non identifié dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
      };
      await notifyTrichineUsers({
        users: [...recipients.values()],
        type: TrichineNotificationType.RESULTAT_ANALYSE,
        objetType: TrichineObjetType.POOL,
        objetId: pool.id,
        title: `Résultat LNR — pool ${pool.reference_pool}`,
        message: messages[body.resultat_analyse]!,
        notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_${body.resultat_analyse}`,
        excludeUserIds: [req.user.id],
      });
    }

    const updatedPool = await prisma.trichinePool.findUnique({ where: { id: pool.id } });
    res.status(200).send({ ok: true, data: { pool: updatedPool }, error: '' });
  })
);

const refusSchema = z.object({
  raison_refus: z.string().min(1),
});

router.post(
  '/pool/:pool_id/refuser',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = refusSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'La raison du refus est obligatoire');
    }
    const found = await findPoolForLabo(req.params.pool_id, context);
    if (!found) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const { pool, ftp } = found;
    if (isTerminalResult(pool.resultat_analyse)) {
      return sendError(res, 400, 'Un résultat a déjà été saisi pour ce pool');
    }

    const updatedPool = await prisma.trichinePool.update({
      where: { id: pool.id },
      data: {
        resultat_analyse: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
        raison_refus: bodyResult.data.raison_refus,
        refus_par_user_id: req.user.id,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: pool.resultat_analyse,
      nouveauStatut: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
      userId: req.user.id,
      commentaire: `Refus : ${bodyResult.data.raison_refus}`,
    });
    await recomputePoolAndLinkedFTPs(pool.id, req.user.id);

    const emitterUsers = await getFtpEmitterUsers(ftp);
    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.POOL_REFUSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Pool ${pool.reference_pool} refusé par le laboratoire`,
      message: `Le laboratoire n'a pas pu analyser le pool ${pool.reference_pool} : ${bodyResult.data.raison_refus}. De nouveaux prélèvements sont nécessaires.`,
      notificationLogAction: `TRICHINE_POOL_REFUSE_${pool.reference_pool}`,
    });

    res.status(200).send({ ok: true, data: { pool: updatedPool }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

const documentSchema = z.object({
  type: z.string().optional(),
  fichier_url: z.string().min(1),
});

router.post(
  '/pool/:pool_id/documents',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = documentSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const found = await findPoolForLabo(req.params.pool_id, context);
    if (!found) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const document = await prisma.trichineDocument.create({
      data: {
        type: bodyResult.data.type ?? TrichineDocumentType.RAPPORT_COFRAC,
        fichier_url: bodyResult.data.fichier_url,
        ajoute_par_user_id: req.user.id,
        pool_id: found.pool.id,
      },
    });
    res.status(200).send({ ok: true, data: { document }, error: '' });
  })
);

const photosSchema = z.object({
  fichier_urls: z.array(z.string().min(1)).min(1),
});

// LVD : upload des photographies de larves sur la FTP de confirmation à destination du LNR
router.post(
  '/ftp/:ftp_id/photos',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = photosSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const ftp = await prisma.trichineFTP.findUnique({ where: { id: req.params.ftp_id } });
    const canAccess =
      ftp &&
      !ftp.deleted_at &&
      ((ftp.expediteur_entity_id && context.entityIds.includes(ftp.expediteur_entity_id)) ||
        context.entityIds.includes(ftp.destinataire_entity_id));
    if (!canAccess) {
      return sendError(res, 404, 'FTP introuvable');
    }
    const documents = [];
    for (const fichierUrl of bodyResult.data.fichier_urls) {
      documents.push(
        await prisma.trichineDocument.create({
          data: {
            type: TrichineDocumentType.PHOTOGRAPHIE_LARVE,
            fichier_url: fichierUrl,
            ajoute_par_user_id: req.user.id,
            ftp_id: ftp.id,
          },
        })
      );
    }
    res.status(200).send({ ok: true, data: { documents }, error: '' });
  })
);

export default router;
