import express from 'express';
import passport from 'passport';
import z from 'zod';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  TrichineAliasObjet,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { avecNombreLarves } from '~/prisma-omit';
import { catchErrors } from '~/middlewares/errors';
import { getArchivedOrFreshFtpPdf } from '~/utils/trichine-ftp-document';
import {
  DOCUMENT_CONTENT_TYPE_BY_EXTENSION,
  storeTrichineDocument,
  uploadedFileSchema,
} from '~/utils/trichine-document-upload';
import type { RequestWithUser } from '~/types/request';
import { capture } from '~/third-parties/sentry';
import { getFromCellar, IS_CELLAR_CONFIGURED } from '~/third-parties/cellar';
import {
  getFtpEmitterUsers,
  isFtpPartie,
  logTrichineStatutChange,
  notifyTrichineUsers,
  TrichineDocumentType,
  TrichineNotificationType,
  TrichineObjetType,
} from '~/utils/trichine';
import dayjs from 'dayjs';
import { TRICHINE_RESULTAT_EMAIL_LABELS } from '~/templates/trichine-email';
import { isTerminalResult, recomputePoolAndLinkedFTPs } from '~/utils/trichine-status';
import {
  applyPoolResult,
  describePoolResultActions,
  resultatSchema,
  validateResultForPool,
} from '~/utils/trichine-result';
import {
  ImportFormatError,
  mapRow,
  parseLimsFile,
  valeursResultatAcceptees,
  type MappedLimsRow,
} from '~/utils/lims-parse';
import { aliasReferenceRefusee, trichineAliasesInclude } from '~/utils/trichine-alias';
import type { LaboResultsImportResponse, LaboResultsPreviewResponse, LimsResultRow } from '~/types/responses';

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
  ...trichineAliasesInclude,
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

// Fiche liée (d'origine ou de confirmation) : de quoi l'afficher et vérifier l'accès du labo
const ftpLieeSelect = {
  numero_fiche: true,
  statut_logistique: true,
  deleted_at: true,
  destinataire_entity_id: true,
  expediteur_entity_id: true,
} as const;

type FtpLiee = Prisma.TrichineFTPGetPayload<{ select: typeof ftpLieeSelect }>;

// Le LNR reçoit une fiche de confirmation sans être partie prenante de la fiche d'origine :
// on ne lui montre le lien que si la fiche liée lui appartient aussi.
function ftpLieeVisible(ftp: FtpLiee, context: LaboContext) {
  if (ftp.deleted_at || ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON) return false;
  return (
    context.entityIds.includes(ftp.destinataire_entity_id) ||
    (!!ftp.expediteur_entity_id && context.entityIds.includes(ftp.expediteur_entity_id))
  );
}

function projeterFtpLiee(ftp: FtpLiee) {
  return { numero_fiche: ftp.numero_fiche, statut_logistique: ftp.statut_logistique };
}

const poolForLaboInclude = Prisma.validator<Prisma.TrichinePoolInclude>()({
  TrichineEchantillons: {
    where: { deleted_at: null },
    include: {
      Carcasse: {
        select: {
          zacharie_carcasse_id: true,
          premier_detenteur_user_id: true,
          current_owner_user_id: true,
          current_owner_entity_id: true,
          svi_ipm2_date: true,
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
});

type LaboPool = Prisma.TrichinePoolGetPayload<{ include: typeof poolForLaboInclude }>;
type LaboLink = LaboPool['TrichinePoolFTPs'][number];
type LaboFtp = LaboLink['TrichineFTP'];

// Le lien (non brouillon) par lequel le pool est arrivé dans un des laboratoires de l'utilisateur.
function pickLaboLink(pool: LaboPool, context: LaboContext): LaboLink | null {
  return (
    pool.TrichinePoolFTPs.find(
      ({ TrichineFTP: ftp }) => isFtpPartie(ftp) && context.entityIds.includes(ftp.destinataire_entity_id)
    ) ?? null
  );
}

/**
 * Retrouve le pool + le lien (et donc la FTP) par lequel il est arrivé dans un des laboratoires
 * de l'utilisateur (le plus récent, hors brouillons).
 */
async function findPoolForLabo(poolId: string, context: LaboContext) {
  const pool = await prisma.trichinePool.findUnique({
    where: { id: poolId },
    include: poolForLaboInclude,
    omit: avecNombreLarves,
  });
  if (!pool || pool.deleted_at) return null;
  const link = pickLaboLink(pool, context);
  if (!link) return null;
  return { pool, ftp: link.TrichineFTP };
}

type PoolTrouve = { pool: LaboPool; ftp: LaboFtp };

/**
 * Variante batchée : rapproche des références lues dans un fichier aux pools destinés aux
 * laboratoires de l'utilisateur. Une référence est soit celle de Zacharie (P-YY-…), qui prime
 * toujours, soit l'alias que le laboratoire a donné au pool (casse ignorée, comme son unicité).
 * Un alias porté par deux pools (deux laboratoires de l'utilisateur) est ambigu : il ne rapproche
 * rien. Sert à l'import de résultats (une requête pour tout le fichier).
 */
async function findPoolsForLabo(references: string[], context: LaboContext) {
  const parReference = new Map<string, PoolTrouve>();
  const parAlias = new Map<string, PoolTrouve | 'ambigu'>();
  const trouver = (reference: string) => {
    const parAliasTrouve = parAlias.get(reference.toLowerCase());
    return parReference.get(reference) ?? (parAliasTrouve === 'ambigu' ? undefined : parAliasTrouve);
  };
  if (!references.length) return trouver;
  // Égalité stricte sur lower(reference), comme l'index unique : le filtre insensible à la casse de
  // Prisma passe par ILIKE, où un `%` ou un `_` lu dans le fichier vaudrait joker
  const referencesMinuscules = [...new Set(references.map((reference) => reference.toLowerCase()))];
  const aliasTrouves = await prisma.$queryRaw<Array<{ pool_id: string }>>`
    SELECT "pool_id" FROM "TrichineAlias"
    WHERE "objet_type" = 'POOL'
      AND "entity_id" IN (${Prisma.join(context.entityIds)})
      AND lower("reference") IN (${Prisma.join(referencesMinuscules)})
  `;
  const pools = await prisma.trichinePool.findMany({
    where: {
      deleted_at: null,
      OR: [
        { reference_pool: { in: references } },
        { id: { in: aliasTrouves.map((alias) => alias.pool_id) } },
      ],
    },
    omit: avecNombreLarves,
    include: {
      ...poolForLaboInclude,
      Aliases: { where: { entity_id: { in: context.entityIds } }, select: { reference: true } },
    },
  });
  for (const { Aliases, ...pool } of pools) {
    const link = pickLaboLink(pool, context);
    if (!link) continue;
    const trouve = { pool, ftp: link.TrichineFTP };
    parReference.set(pool.reference_pool, trouve);
    for (const { reference } of Aliases) {
      const cle = reference.toLowerCase();
      const deja = parAlias.get(cle);
      parAlias.set(cle, deja && deja !== 'ambigu' && deja.pool.id !== pool.id ? 'ambigu' : (deja ?? trouve));
    }
  }
  return trouver;
}

/* -------------------------------------------------------------------------- */
/* Mon laboratoire                                                             */
/* -------------------------------------------------------------------------- */

router.get(
  '/me',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const laboratoires = await prisma.entity.findMany({
      where: { id: { in: context.entityIds } },
      select: {
        id: true,
        nom_d_usage: true,
        raison_sociale: true,
        siret: true,
        address_ligne_1: true,
        address_ligne_2: true,
        code_postal: true,
        ville: true,
        is_lnr: true,
      },
    });
    res.status(200).send({ ok: true, data: { laboratoires, isLnr: context.isLnr }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* FTP reçues                                                                  */
/* -------------------------------------------------------------------------- */

router.get(
  '/ftp',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    // Un LVD est destinataire des colis qu'il reçoit, mais expéditeur de la FTP de confirmation
    // générée vers le LNR sur un résultat douteux : les deux lui appartiennent.
    const ftps = await prisma.trichineFTP.findMany({
      where: {
        OR: [
          { destinataire_entity_id: { in: context.entityIds } },
          { expediteur_entity_id: { in: context.entityIds } },
        ],
        statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
        deleted_at: null,
      },
      include: {
        ...expediteurLaboSelect,
        DestinataireEntity: {
          select: { id: true, is_lnr: true, nom_d_usage: true, raison_sociale: true },
        },
        ...trichineAliasesInclude,
        TrichinePoolFTPs: {
          include: {
            TrichinePool: {
              omit: avecNombreLarves,
              include: {
                ...trichineAliasesInclude,
                // Uniquement pour compter les carcasses en attente d'IPM2 : la projection
                // renvoyée au labo (§10.2) ne contient pas les échantillons.
                TrichineEchantillons: {
                  where: { deleted_at: null },
                  select: { Carcasse: { select: { svi_ipm2_date: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { date_envoi: 'desc' },
    });
    res.status(200).send({
      ok: true,
      data: {
        ftps: ftps.map(({ TrichinePoolFTPs, ...ftp }) => ({
          ...ftp,
          direction: context.entityIds.includes(ftp.destinataire_entity_id)
            ? ('recue' as const)
            : ('envoyee' as const),
          // Une IPM2 signifie que le SVI a statué sur la carcasse : le résultat trichine est traité
          carcasses_sans_ipm2: TrichinePoolFTPs.reduce(
            (total, lien) =>
              total +
              lien.TrichinePool.TrichineEchantillons.filter(
                (echantillon) => !echantillon.Carcasse.svi_ipm2_date
              ).length,
            0
          ),
          TrichinePoolFTPs: TrichinePoolFTPs.map(
            ({ TrichinePool: { TrichineEchantillons, ...pool }, ...lien }) => ({
              ...lien,
              TrichinePool: pool,
            })
          ),
        })),
      },
      error: '',
    });
  })
);

// Détail par référence (cf convention d'adressage dans controllers/trichine.ts) :
// c'est le numéro que le laboratoire lit sur la fiche papier jointe au colis.
router.get(
  '/ftp/:reference',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { numero_fiche: req.params.reference },
      include: {
        ...expediteurLaboSelect,
        DestinataireEntity: {
          select: { id: true, is_lnr: true, nom_d_usage: true, raison_sociale: true },
        },
        FTPParent: { select: ftpLieeSelect },
        FTPChildren: {
          select: { ...ftpLieeSelect, id: true, TrichinePoolFTPs: { select: { pool_id: true } } },
        },
        TrichinePoolFTPs: {
          include: {
            TrichinePool: {
              omit: avecNombreLarves,
              include: {
                TrichineEchantillons: { where: { deleted_at: null }, include: echantillonLaboInclude },
                Documents: { where: { deleted_at: null } },
                ...trichineAliasesInclude,
              },
            },
          },
        },
        Documents: { where: { deleted_at: null } },
        ...trichineAliasesInclude,
      },
    });
    const estDestinataire = !!ftp && context.entityIds.includes(ftp.destinataire_entity_id);
    const estExpediteur = !!ftp?.expediteur_entity_id && context.entityIds.includes(ftp.expediteur_entity_id);
    if (
      !ftp ||
      ftp.deleted_at ||
      ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON ||
      (!estDestinataire && !estExpediteur)
    ) {
      return sendError(res, 404, 'FTP introuvable');
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.FTP, objet_id: ftp.id },
      orderBy: { date_changement: 'desc' },
    });
    const { FTPParent, FTPChildren, TrichinePoolFTPs, ...ftpSansLiens } = ftp;
    res.status(200).send({
      ok: true,
      data: {
        ftp: {
          ...ftpSansLiens,
          TrichinePoolFTPs,
          FTPParent: FTPParent && ftpLieeVisible(FTPParent, context) ? projeterFtpLiee(FTPParent) : null,
          // id et pools portés : le labo émetteur télécharge la fiche à joindre au colis depuis chaque pool
          FTPChildren: FTPChildren.filter((enfant) => ftpLieeVisible(enfant, context)).map((enfant) => ({
            ...projeterFtpLiee(enfant),
            id: enfant.id,
            pool_ids: enfant.TrichinePoolFTPs.map((lien) => lien.pool_id),
          })),
        },
        historique,
        direction: estDestinataire ? 'recue' : 'envoyee',
      },
      error: '',
    });
  })
);

// Même document que celui imprimé par l'émetteur (le colis peut arriver sans son papier)
router.get(
  '/ftp/:ftp_id/pdf',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      select: {
        numero_fiche: true,
        destinataire_entity_id: true,
        expediteur_entity_id: true,
        statut_logistique: true,
        deleted_at: true,
      },
    });
    // Mêmes droits que le détail : le labo lit la fiche qu'il reçoit comme celle qu'il envoie
    // (FTP de confirmation générée vers le LNR sur résultat douteux)
    const estDestinataire = !!ftp && context.entityIds.includes(ftp.destinataire_entity_id);
    const estExpediteur = !!ftp?.expediteur_entity_id && context.entityIds.includes(ftp.expediteur_entity_id);
    if (
      !ftp ||
      ftp.deleted_at ||
      ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON ||
      (!estDestinataire && !estExpediteur)
    ) {
      return sendError(res, 404, 'FTP introuvable');
    }
    const pdf = await getArchivedOrFreshFtpPdf(req.params.ftp_id);
    if (!pdf) {
      return sendError(res, 404, 'FTP introuvable');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FTP-${ftp.numero_fiche}.pdf"`);
    res.status(200).send(pdf);
  })
);

// Détail d'un pool reçu, par sa référence : le labo saisit son résultat depuis cette page
// comme depuis la fiche de transmission. Projection carcasse stricte (§10.2).
router.get(
  '/pool/:reference',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const pool = await prisma.trichinePool.findUnique({
      where: { reference_pool: req.params.reference },
      omit: avecNombreLarves,
      include: {
        TrichineEchantillons: {
          where: { deleted_at: null },
          include: echantillonLaboInclude,
          orderBy: { reference_echantillon: 'asc' },
        },
        ...trichineAliasesInclude,
        TrichinePoolFTPs: {
          include: {
            TrichineFTP: {
              include: {
                ...expediteurLaboSelect,
                DestinataireEntity: {
                  select: { id: true, is_lnr: true, nom_d_usage: true, raison_sociale: true },
                },
              },
            },
          },
          orderBy: { date_ajout: 'desc' },
        },
        PoolParent: { select: { reference_pool: true } },
        Documents: { where: { deleted_at: null } },
      },
    });
    // Le pool doit être arrivé par une FTP non brouillon destinée à un des laboratoires de l'utilisateur
    const ftp = pool?.TrichinePoolFTPs.map((link) => link.TrichineFTP).find(
      (candidate) =>
        !candidate.deleted_at &&
        candidate.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON &&
        context.entityIds.includes(candidate.destinataire_entity_id)
    );
    if (!pool || pool.deleted_at || !ftp) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.POOL, objet_id: pool.id },
      orderBy: { date_changement: 'desc' },
    });
    res.status(200).send({ ok: true, data: { pool, ftp, historique }, error: '' });
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
      email: {
        subject: `Prélèvements réceptionnés · FTP ${ftp.numero_fiche}`,
        tone: 'info',
        badge: 'Prélèvements réceptionnés',
        heading: 'Vos prélèvements sont arrivés au laboratoire',
        intro: `Le laboratoire a bien réceptionné les prélèvements de la fiche de transmission ${ftp.numero_fiche}. Les analyses de recherche de trichine vont démarrer.`,
        details: [
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
          { label: 'Date de réception', value: dayjs(dateReception).format('DD/MM/YYYY') },
          { label: 'Pools', value: String(ftp.TrichinePoolFTPs.length) },
        ],
        actions: [
          'Aucune action de votre part pour le moment.',
          'Vous serez notifié dès que le laboratoire aura rendu un résultat.',
          'En attendant le résultat, les carcasses concernées ne doivent pas être mises sur le marché.',
        ],
      },
      notificationLogAction: `TRICHINE_FTP_RECUE_${ftp.numero_fiche}`,
    });

    res.status(200).send({ ok: true, data: { ftp: updatedFtp }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Saisie des résultats                                                        */
/* -------------------------------------------------------------------------- */

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

    const outcome = await applyPoolResult({ pool, ftp, body, userId: req.user.id, isLnr, origine: 'saisie' });
    if (outcome.kind === 'error') {
      return sendError(res, outcome.status, outcome.error);
    }
    res.status(200).send({
      ok: true,
      data: { pool: outcome.pool, ftp_confirmation: outcome.ftpConfirmation },
      error: '',
    });
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
      email: {
        subject: `Pool refusé · ${pool.reference_pool}`,
        tone: 'warning',
        badge: 'Analyse impossible',
        heading: 'Le laboratoire n’a pas pu analyser votre pool',
        intro: `Le laboratoire a refusé le pool ${pool.reference_pool} : l’analyse de recherche de trichine n’a pas pu être réalisée.`,
        details: [
          { label: 'Pool', value: pool.reference_pool },
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
          { label: 'Motif du refus', value: bodyResult.data.raison_refus },
        ],
        actions: [
          'Réalisez de nouveaux prélèvements sur les carcasses concernées et envoyez-les au laboratoire.',
          'En attendant un résultat, les carcasses ne doivent pas être mises sur le marché.',
        ],
      },
      notificationLogAction: `TRICHINE_POOL_REFUSE_${pool.reference_pool}`,
    });

    res.status(200).send({ ok: true, data: { pool: updatedPool }, error: '' });
  })
);

const correctionSchema = resultatSchema.extend({
  raison: z.string().min(1),
});

/**
 * Correction d'un résultat déjà rendu (cf doc/trichine.md — édition/annulation).
 * Deux garde-fous : le SVI ne doit pas avoir statué sur les carcasses (passé l'IPM2, une
 * décision sanitaire a été prise et se rattrape hors application), et un DOUTEUX n'est pas
 * corrigeable puisque le colis est déjà reparti au LNR.
 */
router.post(
  '/pool/:pool_id/corriger-resultat',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = correctionSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'La raison de la correction est obligatoire');
    }
    // Les analyses du pool sont terminées : la référence du laboratoire est figée (cf trichine-alias)
    const { raison, reference_labo: _referenceFigee, ...body } = bodyResult.data;

    const found = await findPoolForLabo(req.params.pool_id, context);
    if (!found) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const { pool, ftp } = found;
    if (!pool.resultat_analyse) {
      return sendError(res, 400, "Aucun résultat n'a encore été saisi pour ce pool");
    }
    if (pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX) {
      return sendError(
        res,
        400,
        'La confirmation est déjà partie au laboratoire national de référence : ce résultat ne peut plus être corrigé'
      );
    }
    const ipm2 = pool.TrichineEchantillons.some((echantillon) => !!echantillon.Carcasse.svi_ipm2_date);
    if (ipm2) {
      return sendError(
        res,
        400,
        'Le service d’inspection a déjà statué sur une carcasse de ce pool : le résultat ne peut plus être corrigé ici'
      );
    }

    const ancienResultat = pool.resultat_analyse;
    // On remet le pool à zéro pour que applyPoolResult applique la correction par le même
    // chemin qu'une saisie : mêmes gardes, mêmes effets de bord, mêmes notifications.
    await prisma.trichinePool.update({
      where: { id: pool.id },
      data: {
        resultat_analyse: null,
        parasite_identifie: null,
        raison_refus: null,
        refus_par_user_id: null,
      },
    });
    const outcome = await applyPoolResult({
      pool: { ...pool, resultat_analyse: null },
      ftp,
      body,
      userId: req.user.id,
      isLnr: ftp.DestinataireEntity.is_lnr,
      origine: 'saisie',
    });
    if (outcome.kind === 'error') {
      // La correction est refusée : on restitue le résultat d'origine
      await prisma.trichinePool.update({
        where: { id: pool.id },
        data: {
          resultat_analyse: ancienResultat,
          parasite_identifie: pool.parasite_identifie,
          raison_refus: pool.raison_refus,
          refus_par_user_id: pool.refus_par_user_id,
        },
      });
      return sendError(res, outcome.status, outcome.error);
    }

    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: ancienResultat,
      nouveauStatut: body.resultat_analyse,
      userId: req.user.id,
      commentaire: `Correction du résultat : ${raison}`,
    });

    const emitterUsers = await getFtpEmitterUsers(ftp);
    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat corrigé — pool ${pool.reference_pool}`,
      message: `Le laboratoire a corrigé le résultat du pool ${pool.reference_pool} : ${raison}.`,
      email: {
        subject: `Résultat corrigé · pool ${pool.reference_pool}`,
        tone: 'warning',
        badge: 'Résultat corrigé',
        heading: 'Le laboratoire a corrigé un résultat',
        intro: `Le laboratoire a corrigé le résultat d’analyse du pool ${pool.reference_pool}. Le nouveau résultat remplace le précédent.`,
        details: [
          { label: 'Pool', value: pool.reference_pool },
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
          {
            label: 'Ancien résultat',
            value: ancienResultat ? TRICHINE_RESULTAT_EMAIL_LABELS[ancienResultat] : 'Aucun',
          },
          { label: 'Nouveau résultat', value: TRICHINE_RESULTAT_EMAIL_LABELS[body.resultat_analyse] },
          { label: 'Raison de la correction', value: raison },
        ],
        actions: [
          'Vérifiez dans Zacharie ce que le nouveau résultat implique pour les carcasses du pool.',
          'Si des décisions ont été prises sur la base de l’ancien résultat, réexaminez-les.',
        ],
      },
      notificationLogAction: `TRICHINE_RESULTAT_CORRIGE_${pool.reference_pool}`,
    });

    res.status(200).send({ ok: true, data: { pool: outcome.pool }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

const documentSchema = z.object({
  type: z.string().optional(),
  file: uploadedFileSchema,
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
    const stored = await storeTrichineDocument({
      type: bodyResult.data.type ?? TrichineDocumentType.RAPPORT_COFRAC,
      file: bodyResult.data.file,
      userId: req.user.id,
      poolId: found.pool.id,
    });
    if (stored.kind === 'error') {
      return sendError(res, stored.status, stored.error);
    }
    res.status(200).send({ ok: true, data: { document: stored.document }, error: '' });
  })
);

// Téléchargement d'un document déposé sur un pool (rapport d'analyse).
// Le fichier transite par l'API plutôt que par une URL publique : les droits sont ceux du pool.
router.get(
  '/pool/:pool_id/document/:document_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const found = await findPoolForLabo(req.params.pool_id, context);
    if (!found) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const document = await prisma.trichineDocument.findFirst({
      where: { id: req.params.document_id, pool_id: found.pool.id, deleted_at: null },
    });
    const file =
      document?.fichier_url && IS_CELLAR_CONFIGURED ? await getFromCellar(document.fichier_url) : null;
    if (!document || !file) {
      return sendError(res, 404, 'Document introuvable');
    }
    const extension = document.fichier_url.split('.').pop() ?? '';
    res.setHeader(
      'Content-Type',
      DOCUMENT_CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${found.pool.reference_pool}-${document.id}.${extension}"`
    );
    res.send(file);
  })
);

const photosSchema = z.object({
  files: z.array(uploadedFileSchema).min(1),
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
    for (const file of bodyResult.data.files) {
      const stored = await storeTrichineDocument({
        type: TrichineDocumentType.PHOTOGRAPHIE_LARVE,
        file,
        userId: req.user.id,
        ftpId: ftp.id,
      });
      if (stored.kind === 'error') {
        return sendError(res, stored.status, stored.error);
      }
      documents.push(stored.document);
    }
    res.status(200).send({ ok: true, data: { documents }, error: '' });
  })
);

// Téléchargement d'une photographie de larve déposée sur une FTP de confirmation : mêmes droits que le dépôt
router.get(
  '/ftp/:ftp_id/document/:document_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const ftp = await prisma.trichineFTP.findUnique({ where: { id: req.params.ftp_id } });
    const canAccess =
      ftp &&
      !ftp.deleted_at &&
      ((ftp.expediteur_entity_id && context.entityIds.includes(ftp.expediteur_entity_id)) ||
        context.entityIds.includes(ftp.destinataire_entity_id));
    if (!canAccess) {
      return sendError(res, 404, 'FTP introuvable');
    }
    const document = await prisma.trichineDocument.findFirst({
      where: { id: req.params.document_id, ftp_id: ftp.id, deleted_at: null },
    });
    const file =
      document?.fichier_url && IS_CELLAR_CONFIGURED ? await getFromCellar(document.fichier_url) : null;
    if (!document || !file) {
      return sendError(res, 404, 'Document introuvable');
    }
    const extension = document.fichier_url.split('.').pop() ?? '';
    res.setHeader(
      'Content-Type',
      DOCUMENT_CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ftp.numero_fiche}-${document.id}.${extension}"`
    );
    res.send(file);
  })
);

/* -------------------------------------------------------------------------- */
/* Import de résultats : fichier CSV au format Zacharie (cf utils/lims-parse.ts) */
/* -------------------------------------------------------------------------- */

// Classe une ligne lue du fichier selon le pool retrouvé + les règles de saisie.
// referenceRefusee : motif pour lequel la référence labo de la ligne ne sera pas posée (le résultat l'est).
function classifyLimsRow(
  mapped: MappedLimsRow,
  found: { pool: LaboPool; ftp: LaboFtp } | undefined,
  referenceRefusee: string | null
): LimsResultRow {
  const { erreur_format, ...champs } = mapped;
  const base: LimsResultRow = { ...champs, status: 'matched' };
  if (!found) {
    return { ...base, status: 'unmatched', message: 'Pool introuvable ou non destiné à votre laboratoire' };
  }
  if (!mapped.resultat_analyse) {
    return {
      ...base,
      status: 'invalid',
      message: `Résultat non reconnu : « ${mapped.raw_resultat} ». Valeurs acceptées : ${valeursResultatAcceptees(found.ftp.DestinataireEntity.is_lnr).join(', ')}`,
    };
  }
  if (erreur_format) {
    return { ...base, status: 'invalid', message: erreur_format };
  }
  const invalid = validateResultForPool({
    existingResult: found.pool.resultat_analyse,
    resultat_analyse: mapped.resultat_analyse,
    parasite_identifie: mapped.parasite_identifie,
    nombre_larves: mapped.nombre_larves,
    isLnr: found.ftp.DestinataireEntity.is_lnr,
  });
  if (invalid) {
    return {
      ...base,
      status: invalid.code === 'already_resulted' ? 'conflict' : 'invalid',
      message: invalid.error,
    };
  }
  const nbCarcasses = new Set(
    found.pool.TrichineEchantillons.map(({ Carcasse }) => Carcasse.zacharie_carcasse_id)
  ).size;
  const { effet, actions } = describePoolResultActions({
    resultat_analyse: mapped.resultat_analyse,
    reference_pool: found.pool.reference_pool,
    nbCarcasses,
    ftpNumero: found.ftp.numero_fiche,
    referenceLabo: referenceRefusee ? undefined : mapped.reference_labo,
  });
  return {
    ...base,
    message: referenceRefusee ? `Référence interne ignorée : ${referenceRefusee}` : undefined,
    effet,
    nb_carcasses: nbCarcasses,
    actions,
    reference_pool_zacharie: found.pool.reference_pool,
  };
}

// Pools encore sans résultat de chaque fiche : une fiche reçue se clôture quand ils en ont tous un
async function poolsSansResultatParFtp(ftpIds: string[]) {
  const liens = await prisma.trichinePoolFTP.findMany({
    where: { ftp_id: { in: ftpIds }, TrichinePool: { deleted_at: null, resultat_analyse: null } },
    select: { ftp_id: true, TrichinePool: { select: { reference_pool: true } } },
  });
  const parFtp = new Map<string, string[]>();
  for (const lien of liens) {
    parFtp.set(lien.ftp_id, [...(parFtp.get(lien.ftp_id) ?? []), lien.TrichinePool.reference_pool]);
  }
  return parFtp;
}

// Fichier CSV transmis encodé en base64
const previewSchema = z.object({
  filename: z.string().optional(),
  content: z.string().min(1),
});

router.post(
  '/results/preview',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = previewSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Fichier manquant');
    }

    let content: string;
    try {
      content = Buffer.from(bodyResult.data.content, 'base64').toString('utf-8');
    } catch {
      return sendError(res, 400, 'Contenu base64 invalide');
    }

    let rawRows: Array<Record<string, string>>;
    try {
      rawRows = parseLimsFile(content);
    } catch (error) {
      if (error instanceof ImportFormatError) return sendError(res, 400, error.message);
      capture(error as Error, { extra: { filename: bodyResult.data.filename } });
      return sendError(res, 400, 'Fichier illisible (CSV attendu)');
    }

    const lignes = rawRows.filter((raw) => raw.reference_pool?.trim());
    const trouverPool = await findPoolsForLabo(
      lignes.map((raw) => raw.reference_pool.trim()),
      context
    );
    const ftpIds = [
      ...new Set(lignes.map((raw) => trouverPool(raw.reference_pool.trim())?.ftp.id).filter(Boolean)),
    ] as string[];
    const poolsSansResultat = await poolsSansResultatParFtp(ftpIds);
    const rows: Array<LimsResultRow> = [];
    // Un pool ne reçoit qu'un résultat : seule sa première ligne importable dans le fichier est retenue
    const poolsDejaRetenus = new Set<string>();
    for (const raw of lignes) {
      const found = trouverPool(raw.reference_pool.trim());
      // non_negatif n'a pas le même sens pour un LVD et pour le LNR : on lit la valeur selon le
      // laboratoire destinataire de la fiche par laquelle le pool est arrivé
      const row = mapRow(raw, found ? found.ftp.DestinataireEntity.is_lnr : context.isLnr);
      const reference = row.reference_labo?.trim();
      // Une référence labo refusée n'empêche pas l'import du résultat : on prévient dès l'aperçu
      const referenceRefusee =
        found && reference
          ? await aliasReferenceRefusee({
              entityId: found.ftp.destinataire_entity_id,
              objetType: TrichineAliasObjet.POOL,
              objetId: found.pool.id,
              reference,
            })
          : null;
      const classee = classifyLimsRow(row, found, referenceRefusee);
      if (classee.status === 'matched' && poolsDejaRetenus.has(found!.pool.id)) {
        rows.push({
          ...classee,
          status: 'conflict',
          message: 'Ce pool apparaît plusieurs fois dans le fichier : seule sa première ligne est importée',
          effet: undefined,
          nb_carcasses: undefined,
          actions: undefined,
        });
        continue;
      }
      if (classee.status === 'matched') poolsDejaRetenus.add(found!.pool.id);
      rows.push(
        classee.status === 'matched'
          ? {
              ...classee,
              ftp: {
                numero_fiche: found!.ftp.numero_fiche,
                recue: found!.ftp.statut_logistique === TrichineStatutLogistiqueFTP.RECUE,
                pools_sans_resultat: poolsSansResultat.get(found!.ftp.id) ?? [],
              },
            }
          : classee
      );
    }

    const counts = { matched: 0, unmatched: 0, invalid: 0, conflict: 0 };
    for (const row of rows) counts[row.status]++;

    const response: LaboResultsPreviewResponse = { ok: true, data: { rows, counts }, error: '' };
    res.status(200).send(response);
  })
);

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        reference_pool: z.string().min(1),
        resultat_analyse: z.enum(
          Object.values(TrichineResultatAnalyse) as [TrichineResultatAnalyse, ...TrichineResultatAnalyse[]]
        ),
        parasite_identifie: z.string().optional(),
        nombre_larves: z.number().int().min(1).optional(),
        date_debut_analyse: z.coerce.date().optional(),
        date_fin_analyse: z.coerce.date().optional(),
        reference_labo: z.string().optional(),
        commentaire: z.string().optional(),
      })
    )
    .min(1),
});

router.post(
  '/results/import',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const bodyResult = importSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Lignes invalides');
    }
    // On ne fait jamais confiance aux ids côté client : on re-résout chaque pool dans le scope du labo.
    const trouverPool = await findPoolsForLabo(
      bodyResult.data.rows.map((row) => row.reference_pool),
      context
    );

    let applied = 0;
    let skipped = 0;
    let errors = 0;
    const results: LaboResultsImportResponse['data']['results'] = [];
    // Les pools sont lus une fois avant la boucle : un pool déjà traité ne doit pas recevoir un second
    // résultat (sa version lue n'a pas encore de résultat, la validation ne l'arrêterait pas)
    const poolsTraites = new Set<string>();

    for (const row of bodyResult.data.rows) {
      const found = trouverPool(row.reference_pool);
      if (!found) {
        skipped++;
        results.push({
          reference_pool: row.reference_pool,
          ok: false,
          error: 'Pool introuvable ou non destiné à votre laboratoire',
        });
        continue;
      }
      if (poolsTraites.has(found.pool.id)) {
        skipped++;
        results.push({
          reference_pool: row.reference_pool,
          ok: false,
          error: 'Ce pool apparaît plusieurs fois dans le fichier : seule sa première ligne est importée',
        });
        continue;
      }
      try {
        const outcome = await applyPoolResult({
          pool: found.pool,
          ftp: found.ftp,
          body: row,
          userId: req.user.id,
          isLnr: found.ftp.DestinataireEntity.is_lnr,
          origine: 'automatique',
        });
        if (outcome.kind === 'error') {
          errors++;
          results.push({ reference_pool: row.reference_pool, ok: false, error: outcome.error });
        } else {
          applied++;
          poolsTraites.add(found.pool.id);
          results.push({
            reference_pool: row.reference_pool,
            ok: true,
            ftp_confirmation: outcome.ftpConfirmation ?? undefined,
            avertissement: outcome.referenceIgnoree
              ? `Résultat appliqué, référence interne ignorée : ${outcome.referenceIgnoree}`
              : undefined,
          });
        }
      } catch (error) {
        // Le résultat a pu être écrit en partie : pas de seconde tentative sur ce pool
        poolsTraites.add(found.pool.id);
        capture(error as Error, { extra: { reference_pool: row.reference_pool } });
        errors++;
        results.push({ reference_pool: row.reference_pool, ok: false, error: 'Erreur serveur' });
      }
    }

    const response: LaboResultsImportResponse = {
      ok: true,
      data: { applied, skipped, errors, results },
      error: '',
    };
    res.status(200).send(response);
  })
);

/* -------------------------------------------------------------------------- */
/* Registre : listes plates échantillons / pools reçus par le labo              */
/* -------------------------------------------------------------------------- */

// Rattaché à une FTP non-brouillon destinée à un des laboratoires de l'utilisateur
const laboFtpMatch = (entityIds: string[]): Prisma.TrichinePoolFTPListRelationFilter => ({
  some: {
    TrichineFTP: {
      deleted_at: null,
      statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
      destinataire_entity_id: { in: entityIds },
    },
  },
});

router.get(
  '/echantillons',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const echantillons = await prisma.trichineEchantillon.findMany({
      where: {
        deleted_at: null,
        TrichinePool: { deleted_at: null, TrichinePoolFTPs: laboFtpMatch(context.entityIds) },
      },
      include: {
        Carcasse: { select: carcasseLaboSelect },
        TrichinePool: { select: { reference_pool: true, statut: true, resultat_analyse: true } },
        ...trichineAliasesInclude,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { echantillons }, error: '' });
  })
);

router.get(
  '/pools',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const context = await guardLabo(req, res);
    if (!context) return;
    const pools = await prisma.trichinePool.findMany({
      where: { deleted_at: null, TrichinePoolFTPs: laboFtpMatch(context.entityIds) },
      omit: avecNombreLarves,
      include: {
        TrichineEchantillons: {
          where: { deleted_at: null },
          include: { Carcasse: { select: carcasseLaboSelect } },
        },
        ...trichineAliasesInclude,
        PoolParent: { select: { reference_pool: true } },
        TrichinePoolFTPs: {
          include: {
            TrichineFTP: {
              select: { numero_fiche: true, statut_logistique: true, destinataire_entity_id: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({
      ok: true,
      data: { pools },
      error: '',
    });
  })
);

export default router;
