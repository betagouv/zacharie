import express from 'express';
import passport from 'passport';
import z from 'zod';
import {
  EntityTypes,
  TrichineAliasObjet,
  TrichineSitePrelevement,
  TrichineStatutLogistiqueFTP,
  TrichineResultatAnalyse,
  TrichineType,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { catchErrors } from '~/middlewares/errors';
import { archiveFtpPdf, getArchivedOrFreshFtpPdf } from '~/utils/trichine-ftp-document';
import type { RequestWithUser } from '~/types/request';
import {
  getUsersWorkingForEntity,
  logTrichineStatutChange,
  isFtpPartie,
  nextEchantillonReference,
  nextEchantillonReferences,
  nextFTPReference,
  nextPoolReference,
  referenceCodeForEntity,
  notifyTrichineUsers,
  TrichineNotificationType,
  TrichineObjetType,
  TRICHINE_ESPECE_CONCERNEE,
  TRICHINE_MASSE_DEFAUT_COMPLEMENTAIRE,
  TRICHINE_MASSE_DEFAUT_CONFIRMATION,
  TRICHINE_MASSE_DEFAUT_INITIAL,
  trichineEquipeUserIds,
  userBelongsToEntity,
  validateNouveauPrelevement,
  validatePoolComposition,
  withReferenceRetry,
} from '~/utils/trichine';
import { carcassesAVenirChezEtgWhere, getEtgsLinkedToSviUser } from '~/utils/svi';
import { getEtgsDuServiceExpediteur } from '~/utils/trichine-parties';
import {
  ALIAS_REFERENCE_INVALIDE,
  aliasEntityIdsForUser,
  entiteSviPourObjet,
  aliasReferenceDejaPrise,
  aliasReferenceSchema,
  trichineAliasesInclude,
  upsertAlias,
} from '~/utils/trichine-alias';
import {
  recomputeCarcasseTrichine,
  recomputeEchantillonTrichine,
  recomputeFTPTrichine,
  recomputePoolTrichine,
} from '~/utils/trichine-status';

const router: express.Router = express.Router();

/**
 * Routes émetteur (SVI, circuit agréé).
 * Les routes laboratoire (LVD/LNR) sont dans controllers/laboratoire.ts.
 */

function sendError(res: express.Response, status: number, error: string) {
  res.status(status).send({ ok: false, data: null, error });
}

/**
 * Convention d'adressage : les routes de **lecture d'un objet** prennent sa référence métier
 * (E-/P-/F-…), pas son uuid — c'est ce que manipulent les utilisateurs et les laboratoires,
 * et ça rend les URL de l'app copiables et mémorisables. Les routes d'**action** gardent l'id,
 * elles sont toujours appelées depuis un objet déjà chargé.
 */

// Données carcasse affichées dans les écrans trichine (mêmes champs que la projection labo, §10.2)
const carcasseProjectionSelect = {
  zacharie_carcasse_id: true,
  numero_bracelet: true,
  espece: true,
  date_mise_a_mort: true,
  fei_numero: true,
  // Une carcasse retirée de sa fiche a vu sa décision prise : les écrans n'ont plus à la réclamer
  trichine_retire_de_fei_at: true,
  Fei: { select: { commune_mise_a_mort: true } },
} as const;

// Émetteurs trichine : le SVI, en circuit agréé
function isEmitter(req: RequestWithUser): boolean {
  return req.user.roles.includes(UserRoles.SVI);
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

/**
 * Circuit agréé : le SVI prélève sur les carcasses assignées à son service d'inspection, mais
 * aussi sur celles déjà arrivées chez un ETG rattaché à ce service et pas encore transmises —
 * le prélèvement trichine se fait à l'arrivage, avant la transmission officielle au SVI.
 * Renvoie, parmi les ids demandés, ceux sur lesquels l'utilisateur peut agir.
 */
async function carcassesAccessiblesAuSvi(
  userId: string,
  zacharieCarcasseIds: Array<string>
): Promise<Set<string>> {
  const { sviEntityIds, etgIds } = await getEtgsLinkedToSviUser(userId);
  const carcasses = await prisma.carcasse.findMany({
    where: {
      zacharie_carcasse_id: { in: zacharieCarcasseIds },
      OR: [{ svi_entity_id: { in: sviEntityIds } }, carcassesAVenirChezEtgWhere(etgIds)],
    },
    select: { zacharie_carcasse_id: true },
  });
  return new Set(carcasses.map((carcasse) => carcasse.zacharie_carcasse_id));
}

/**
 * Alias saisis à la création d'un objet : validés (format, unicité pour le service) avant de créer
 * quoi que ce soit, pour ne pas laisser un objet créé sans la référence que l'agent a tapée.
 * L'alias est posé au nom du service d'inspection de l'objet (cf `entiteSviPourObjet`). Seule une
 * saisie simultanée de la même référence peut encore le faire échouer : l'objet reste alors créé
 * sans alias.
 */
type AliasACreer = { kind: 'ok'; entityId: string | null } | { kind: 'error'; error: string };

async function preparerAliases(
  req: RequestWithUser,
  objetType: TrichineAliasObjet,
  references: Array<string>,
  objetEntityId: string | undefined
): Promise<AliasACreer> {
  if (!references.length) return { kind: 'ok', entityId: null };
  const entityId = entiteSviPourObjet(await aliasEntityIdsForUser(req.user), objetEntityId);
  if (!entityId) return { kind: 'error', error: "Aucun service d'inspection associé à votre compte" };
  if (new Set(references.map((reference) => reference.toLowerCase())).size !== references.length) {
    return { kind: 'error', error: 'Une même référence interne est saisie deux fois' };
  }
  for (const reference of references) {
    const dejaPrise = await aliasReferenceDejaPrise({ entityId, objetType, objetId: null, reference });
    if (dejaPrise) return { kind: 'error', error: dejaPrise };
  }
  return { kind: 'ok', entityId };
}

// Champ `alias` optionnel des routes de création : chaîne vide = pas d'alias
const aliasCreationSchema = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined)
  .pipe(aliasReferenceSchema.optional());

function erreurParametres(error: z.ZodError) {
  return error.issues.some((issue) => issue.path.includes('alias'))
    ? ALIAS_REFERENCE_INVALIDE
    : 'Paramètres invalides';
}

/* -------------------------------------------------------------------------- */
/* Échantillons                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ce que les analyses déjà ouvertes disent de chaque carcasse : ses pools actifs, et si elle
 * porte un échantillon encore à regrouper. Sert à refuser un prélèvement qui n'ouvrirait
 * aucune analyse (cf `validateNouveauPrelevement`).
 */
async function etatDesAnalyses(carcasseIds: Array<string>) {
  const echantillons = await prisma.trichineEchantillon.findMany({
    // Un échantillon retiré par le laboratoire n'a jamais été analysé : il ne compte pas
    where: { zacharie_carcasse_id: { in: carcasseIds }, deleted_at: null, retire_par_labo_at: null },
    select: {
      zacharie_carcasse_id: true,
      pool_id: true,
      TrichinePool: { select: { resultat_analyse: true, created_at: true, deleted_at: true } },
    },
  });
  const etats = new Map<
    string,
    {
      pools: Array<{ resultat_analyse: TrichineResultatAnalyse | null; created_at: Date }>;
      aUnEchantillonSansPool: boolean;
    }
  >();
  for (const echantillon of echantillons) {
    const etat = etats.get(echantillon.zacharie_carcasse_id) ?? {
      pools: [],
      aUnEchantillonSansPool: false,
    };
    if (echantillon.TrichinePool && !echantillon.TrichinePool.deleted_at) {
      etat.pools.push({
        resultat_analyse: echantillon.TrichinePool.resultat_analyse,
        created_at: echantillon.TrichinePool.created_at,
      });
    } else if (!echantillon.pool_id) {
      etat.aUnEchantillonSansPool = true;
    }
    etats.set(echantillon.zacharie_carcasse_id, etat);
  }
  for (const etat of etats.values()) {
    etat.pools.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }
  return etats;
}

const echantillonSchema = z.object({
  zacharie_carcasse_id: z.string().min(1),
  site_prelevement: z.enum(Object.values(TrichineSitePrelevement) as [TrichineSitePrelevement]),
  type: z.enum(Object.values(TrichineType) as [TrichineType]).optional(),
  masse_grammes: z.number().int().positive().optional(),
  date_prelevement: z.coerce.date().optional(),
  preleve_par_entity_id: z.string().optional(),
  commentaire: z.string().optional(),
  alias: aliasCreationSchema,
});

router.post(
  '/echantillon',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = echantillonSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, erreurParametres(bodyResult.error));
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
    // Seul le SVI assigné à la carcasse prélève
    const accessibles = await carcassesAccessiblesAuSvi(req.user.id, [carcasse.zacharie_carcasse_id]);
    if (!accessibles.has(carcasse.zacharie_carcasse_id)) {
      return sendError(res, 403, "Cette carcasse n'est pas assignée à votre service d'inspection");
    }
    if (body.preleve_par_entity_id && !(await userBelongsToEntity(req.user.id, body.preleve_par_entity_id))) {
      return sendError(res, 403, "Vous ne faites pas partie de l'entité de prélèvement indiquée");
    }

    const type = body.type ?? TrichineType.INITIAL;
    const etat = (await etatDesAnalyses([carcasse.zacharie_carcasse_id])).get(carcasse.zacharie_carcasse_id);
    const prelevementInvalide = validateNouveauPrelevement({
      type,
      numeroBracelet: carcasse.numero_bracelet,
      pools: etat?.pools ?? [],
      aUnEchantillonSansPool: etat?.aUnEchantillonSansPool ?? false,
    });
    if (prelevementInvalide) {
      return sendError(res, 400, prelevementInvalide);
    }
    const aliasACreer = await preparerAliases(
      req,
      TrichineAliasObjet.ECHANTILLON,
      body.alias ? [body.alias] : [],
      body.preleve_par_entity_id
    );
    if (aliasACreer.kind === 'error') {
      return sendError(res, 400, aliasACreer.error);
    }

    const entityCode = await referenceCodeForEntity(body.preleve_par_entity_id, req.user.id);
    const echantillon = await withReferenceRetry(async () =>
      prisma.trichineEchantillon.create({
        data: {
          reference_echantillon: await nextEchantillonReference(entityCode),
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
    if (aliasACreer.entityId && body.alias) {
      await upsertAlias({
        entityId: aliasACreer.entityId,
        objetType: TrichineAliasObjet.ECHANTILLON,
        objetId: echantillon.id,
        reference: body.alias,
      });
    }
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
        preleve_par_user_id: { in: await trichineEquipeUserIds(req.user) },
        deleted_at: null,
        // Un échantillon retiré par le laboratoire ne se regroupe plus : la carcasse est à re-prélever
        ...(sansPool ? { pool_id: null, retire_par_labo_at: null } : {}),
      },
      include: {
        Carcasse: { select: carcasseProjectionSelect },
        TrichinePool: { select: { reference_pool: true } },
        ...trichineAliasesInclude,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { echantillons }, error: '' });
  })
);

const echantillonsBulkSchema = z.object({
  echantillons: z
    .array(
      z.object({
        zacharie_carcasse_id: z.string().min(1),
        site_prelevement: z.enum(Object.values(TrichineSitePrelevement) as [TrichineSitePrelevement]),
        masse_grammes: z.number().int().positive().optional(),
        date_prelevement: z.coerce.date().optional(),
        alias: aliasCreationSchema,
      })
    )
    .min(1)
    .max(200),
  // Type commun au lot : INITIAL au prélèvement, COMPLEMENTAIRE / CONFIRMATION en 2e intention
  type: z.enum(Object.values(TrichineType) as [TrichineType]).optional(),
  preleve_par_entity_id: z.string().optional(),
  commentaire: z.string().optional(),
});

/**
 * Prélèvement en lot : le SVI prélève sur toutes les carcasses de sanglier d'un arrivage,
 * pas une par une. Tout ou rien — le lot est refusé si une seule carcasse ne convient pas,
 * pour ne pas laisser l'utilisateur avec un prélèvement à moitié fait.
 */
router.post(
  '/echantillons',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = echantillonsBulkSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, erreurParametres(bodyResult.error));
    }
    const body = bodyResult.data;
    const carcasseIds = [...new Set(body.echantillons.map((ligne) => ligne.zacharie_carcasse_id))];
    if (carcasseIds.length !== body.echantillons.length) {
      return sendError(res, 400, "Une carcasse ne peut être prélevée qu'une fois dans un même lot");
    }

    if (body.preleve_par_entity_id && !(await userBelongsToEntity(req.user.id, body.preleve_par_entity_id))) {
      return sendError(res, 403, "Vous ne faites pas partie de l'entité de prélèvement indiquée");
    }

    const carcasses = await prisma.carcasse.findMany({
      where: { zacharie_carcasse_id: { in: carcasseIds }, deleted_at: null },
    });
    const parId = new Map(carcasses.map((carcasse) => [carcasse.zacharie_carcasse_id, carcasse]));
    const accessibles = await carcassesAccessiblesAuSvi(req.user.id, carcasseIds);

    for (const carcasseId of carcasseIds) {
      const carcasse = parId.get(carcasseId);
      if (!carcasse) {
        return sendError(res, 404, `Carcasse ${carcasseId} introuvable`);
      }
      if (carcasse.espece !== TRICHINE_ESPECE_CONCERNEE) {
        return sendError(res, 400, `La carcasse ${carcasse.numero_bracelet} n'est pas un sanglier`);
      }
      if (carcasse.trichine_retire_de_fei_at) {
        return sendError(res, 400, `La carcasse ${carcasse.numero_bracelet} a été retirée de sa fiche`);
      }
      if (!accessibles.has(carcasse.zacharie_carcasse_id)) {
        return sendError(res, 403, `La carcasse ${carcasse.numero_bracelet} ne vous est pas assignée`);
      }
    }

    const type = body.type ?? TrichineType.INITIAL;
    const etats = await etatDesAnalyses(carcasseIds);
    for (const carcasseId of carcasseIds) {
      const etat = etats.get(carcasseId);
      const prelevementInvalide = validateNouveauPrelevement({
        type,
        numeroBracelet: parId.get(carcasseId)?.numero_bracelet ?? null,
        pools: etat?.pools ?? [],
        aUnEchantillonSansPool: etat?.aUnEchantillonSansPool ?? false,
      });
      if (prelevementInvalide) {
        return sendError(res, 400, prelevementInvalide);
      }
    }
    const aliasACreer = await preparerAliases(
      req,
      TrichineAliasObjet.ECHANTILLON,
      body.echantillons.map((ligne) => ligne.alias).filter((alias): alias is string => !!alias),
      body.preleve_par_entity_id
    );
    if (aliasACreer.kind === 'error') {
      return sendError(res, 400, aliasACreer.error);
    }

    const entityCode = await referenceCodeForEntity(body.preleve_par_entity_id, req.user.id);
    const references = await nextEchantillonReferences(entityCode, body.echantillons.length);
    const maintenant = new Date();
    const echantillons = await withReferenceRetry(async () =>
      prisma.$transaction(
        body.echantillons.map((ligne, index) =>
          prisma.trichineEchantillon.create({
            data: {
              reference_echantillon: references[index],
              zacharie_carcasse_id: ligne.zacharie_carcasse_id,
              preleve_par_user_id: req.user.id,
              preleve_par_entity_id: body.preleve_par_entity_id ?? null,
              type,
              site_prelevement: ligne.site_prelevement,
              masse_grammes: ligne.masse_grammes ?? masseDefautParType[type],
              date_prelevement: ligne.date_prelevement ?? maintenant,
              commentaire: body.commentaire ?? null,
            },
          })
        )
      )
    );

    for (const [index, echantillon] of echantillons.entries()) {
      const alias = body.echantillons[index].alias;
      if (aliasACreer.entityId && alias) {
        await upsertAlias({
          entityId: aliasACreer.entityId,
          objetType: TrichineAliasObjet.ECHANTILLON,
          objetId: echantillon.id,
          reference: alias,
        });
      }
      await logTrichineStatutChange({
        objetType: TrichineObjetType.ECHANTILLON,
        objetId: echantillon.id,
        ancienStatut: null,
        nouveauStatut: echantillon.statut,
        userId: req.user.id,
        commentaire: `Création de l'échantillon ${echantillon.reference_echantillon} (prélèvement en lot)`,
      });
      await recomputeCarcasseTrichine(echantillon.zacharie_carcasse_id, req.user.id);
    }

    res.status(200).send({ ok: true, data: { echantillons }, error: '' });
  })
);

/**
 * Un pool est figé dès que la fiche qui le porte est partie au laboratoire : la FTP papier
 * est dans le colis, l'écran ne peut plus diverger d'elle. Tant qu'elle est en brouillon
 * (ou qu'elle a été annulée), tout reste modifiable.
 */
// L'échantillon retiré reste tel que le laboratoire l'a reçu : il trace pourquoi la carcasse est à re-prélever
const ERREUR_RETIRE_PAR_LABO =
  'Cet échantillon a été retiré de son pool par le laboratoire : il ne peut plus être modifié';

async function poolEstFige(poolId: string): Promise<boolean> {
  const links = await prisma.trichinePoolFTP.findMany({
    where: { pool_id: poolId },
    include: { TrichineFTP: { select: { deleted_at: true, statut_logistique: true } } },
  });
  return links.some(({ TrichineFTP: ftp }) => isFtpPartie(ftp));
}

const echantillonEditSchema = z.object({
  site_prelevement: z.enum(Object.values(TrichineSitePrelevement) as [TrichineSitePrelevement]).optional(),
  masse_grammes: z.number().int().positive().optional(),
  date_prelevement: z.coerce.date().optional(),
  commentaire: z.string().optional(),
});

router.put(
  '/echantillon/:echantillon_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = echantillonEditSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const echantillon = await prisma.trichineEchantillon.findUnique({
      where: { id: req.params.echantillon_id },
    });
    if (!echantillon || echantillon.deleted_at) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    if (echantillon.preleve_par_user_id !== req.user.id) {
      return sendError(res, 403, "Cet échantillon n'a pas été prélevé par vous");
    }
    if (echantillon.pool_id && (await poolEstFige(echantillon.pool_id))) {
      return sendError(res, 400, 'Cet échantillon est parti au laboratoire, il ne peut plus être modifié');
    }
    if (echantillon.retire_par_labo_at) {
      return sendError(res, 400, ERREUR_RETIRE_PAR_LABO);
    }

    const body = bodyResult.data;
    const updated = await prisma.trichineEchantillon.update({
      where: { id: echantillon.id },
      data: {
        site_prelevement: body.site_prelevement ?? echantillon.site_prelevement,
        masse_grammes: body.masse_grammes ?? echantillon.masse_grammes,
        date_prelevement: body.date_prelevement ?? echantillon.date_prelevement,
        commentaire: body.commentaire ?? echantillon.commentaire,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: echantillon.id,
      ancienStatut: echantillon.statut,
      nouveauStatut: updated.statut,
      userId: req.user.id,
      commentaire: `Modification de l'échantillon ${echantillon.reference_echantillon}`,
    });

    res.status(200).send({ ok: true, data: { echantillon: updated }, error: '' });
  })
);

router.delete(
  '/echantillon/:echantillon_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const echantillon = await prisma.trichineEchantillon.findUnique({
      where: { id: req.params.echantillon_id },
    });
    if (!echantillon || echantillon.deleted_at) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    if (echantillon.preleve_par_user_id !== req.user.id) {
      return sendError(res, 403, "Cet échantillon n'a pas été prélevé par vous");
    }
    if (echantillon.pool_id) {
      return sendError(res, 400, "Retirez d'abord cet échantillon de son pool");
    }
    if (echantillon.retire_par_labo_at) {
      return sendError(res, 400, ERREUR_RETIRE_PAR_LABO);
    }

    await prisma.trichineEchantillon.update({
      where: { id: echantillon.id },
      data: { deleted_at: new Date() },
    });
    // Un objet supprimé libère ses références : elles resservent pour celui qui le remplace
    await prisma.trichineAlias.deleteMany({ where: { echantillon_id: echantillon.id } });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: echantillon.id,
      ancienStatut: echantillon.statut,
      nouveauStatut: echantillon.statut,
      userId: req.user.id,
      commentaire: `Suppression de l'échantillon ${echantillon.reference_echantillon}`,
    });
    await recomputeCarcasseTrichine(echantillon.zacharie_carcasse_id, req.user.id);

    res.status(200).send({ ok: true, data: {}, error: '' });
  })
);

router.post(
  '/echantillon/:echantillon_id/retirer-du-pool',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const echantillon = await prisma.trichineEchantillon.findUnique({
      where: { id: req.params.echantillon_id },
      include: { TrichinePool: { include: { TrichineEchantillons: { where: { deleted_at: null } } } } },
    });
    if (!echantillon || echantillon.deleted_at) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    if (echantillon.preleve_par_user_id !== req.user.id) {
      return sendError(res, 403, "Cet échantillon n'a pas été prélevé par vous");
    }
    const pool = echantillon.TrichinePool;
    if (!pool || pool.deleted_at) {
      return sendError(res, 400, "Cet échantillon n'est rattaché à aucun pool");
    }
    if (await poolEstFige(pool.id)) {
      return sendError(res, 400, 'Ce pool est parti au laboratoire, sa composition ne peut plus changer');
    }
    // Un pool vide n'existe pas : c'est le pool entier qu'il faut supprimer
    if (pool.TrichineEchantillons.length <= 1) {
      return sendError(res, 400, 'Dernier échantillon du pool : supprimez plutôt le pool');
    }

    await prisma.trichineEchantillon.update({ where: { id: echantillon.id }, data: { pool_id: null } });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: echantillon.id,
      ancienStatut: echantillon.statut,
      nouveauStatut: echantillon.statut,
      userId: req.user.id,
      commentaire: `Retiré du pool ${pool.reference_pool}`,
    });
    await recomputePoolTrichine(pool.id, req.user.id);
    await recomputeEchantillonTrichine(echantillon.id, req.user.id);

    res.status(200).send({ ok: true, data: {}, error: '' });
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
  alias: aliasCreationSchema,
});

router.post(
  '/pool',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = poolSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, erreurParametres(bodyResult.error));
    }
    const body = bodyResult.data;

    const echantillons = await prisma.trichineEchantillon.findMany({
      where: { id: { in: body.echantillon_ids } },
    });
    if (echantillons.length !== body.echantillon_ids.length) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    if (echantillons.some((echantillon) => echantillon.preleve_par_user_id !== req.user.id)) {
      return sendError(res, 403, "Un des échantillons n'a pas été prélevé par vous");
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
    const aliasACreer = await preparerAliases(
      req,
      TrichineAliasObjet.POOL,
      body.alias ? [body.alias] : [],
      body.cree_par_entity_id
    );
    if (aliasACreer.kind === 'error') {
      return sendError(res, 400, aliasACreer.error);
    }

    const entityCode = await referenceCodeForEntity(body.cree_par_entity_id, req.user.id);
    const pool = await withReferenceRetry(async () =>
      prisma.trichinePool.create({
        data: {
          reference_pool: await nextPoolReference(entityCode),
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
    if (aliasACreer.entityId && body.alias) {
      await upsertAlias({
        entityId: aliasACreer.entityId,
        objetType: TrichineAliasObjet.POOL,
        objetId: pool.id,
        reference: body.alias,
      });
    }
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
      where: { cree_par_user_id: { in: await trichineEquipeUserIds(req.user) }, deleted_at: null },
      include: {
        TrichineEchantillons: { where: { deleted_at: null } },
        TrichinePoolFTPs: { include: { TrichineFTP: true } },
        PoolsFilles: { where: { deleted_at: null } },
        Documents: { where: { deleted_at: null } },
        ...trichineAliasesInclude,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { pools }, error: '' });
  })
);

const poolEditSchema = z.object({
  echantillon_ids: z.array(z.string().min(1)).min(1).optional(),
  date_constitution: z.coerce.date().optional(),
  commentaire: z.string().optional(),
});

router.put(
  '/pool/:pool_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = poolEditSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const pool = await prisma.trichinePool.findUnique({
      where: { id: req.params.pool_id },
      include: {
        PoolParent: {
          include: {
            PoolParent: { select: { pool_parent_id: true } },
            TrichineEchantillons: { where: { deleted_at: null }, select: { zacharie_carcasse_id: true } },
          },
        },
        TrichineEchantillons: { where: { deleted_at: null }, select: { id: true } },
      },
    });
    if (!pool || pool.deleted_at) {
      return sendError(res, 404, 'Pool introuvable');
    }
    if (pool.cree_par_user_id !== req.user.id) {
      return sendError(res, 403, "Ce pool n'a pas été créé par vous");
    }
    if (await poolEstFige(pool.id)) {
      return sendError(res, 400, 'Ce pool est parti au laboratoire, il ne peut plus être modifié');
    }

    if (body.echantillon_ids) {
      const echantillons = await prisma.trichineEchantillon.findMany({
        where: { id: { in: body.echantillon_ids } },
      });
      if (echantillons.length !== body.echantillon_ids.length) {
        return sendError(res, 404, 'Échantillon introuvable');
      }
      if (echantillons.some((echantillon) => echantillon.preleve_par_user_id !== req.user.id)) {
        return sendError(res, 403, "Un des échantillons n'a pas été prélevé par vous");
      }
      const parent = pool.PoolParent
        ? {
            id: pool.PoolParent.id,
            pool_parent_id: pool.PoolParent.pool_parent_id,
            resultat_analyse: pool.PoolParent.resultat_analyse,
            carcasseIds: pool.PoolParent.TrichineEchantillons.map((e) => e.zacharie_carcasse_id),
            parentHasGrandParent: !!pool.PoolParent.PoolParent?.pool_parent_id,
          }
        : null;
      const compositionError = validatePoolComposition({ echantillons, parent, poolId: pool.id });
      if (compositionError) {
        return sendError(res, 400, compositionError);
      }

      const retires = pool.TrichineEchantillons.map((e) => e.id).filter(
        (id) => !body.echantillon_ids!.includes(id)
      );
      await prisma.trichineEchantillon.updateMany({
        where: { id: { in: retires } },
        data: { pool_id: null },
      });
      await prisma.trichineEchantillon.updateMany({
        where: { id: { in: body.echantillon_ids } },
        data: { pool_id: pool.id },
      });
      for (const echantillonId of retires) {
        await recomputeEchantillonTrichine(echantillonId, req.user.id);
      }
    }

    const updated = await prisma.trichinePool.update({
      where: { id: pool.id },
      data: {
        date_constitution: body.date_constitution ?? pool.date_constitution,
        commentaire: body.commentaire ?? pool.commentaire,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: pool.statut,
      nouveauStatut: updated.statut,
      userId: req.user.id,
      commentaire: `Modification du pool ${pool.reference_pool}`,
    });
    await recomputePoolTrichine(pool.id, req.user.id);

    res.status(200).send({ ok: true, data: { pool: updated }, error: '' });
  })
);

router.delete(
  '/pool/:pool_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const pool = await prisma.trichinePool.findUnique({
      where: { id: req.params.pool_id },
      include: {
        PoolsFilles: { where: { deleted_at: null }, select: { reference_pool: true } },
        TrichineEchantillons: { where: { deleted_at: null }, select: { id: true } },
      },
    });
    if (!pool || pool.deleted_at) {
      return sendError(res, 404, 'Pool introuvable');
    }
    if (pool.cree_par_user_id !== req.user.id) {
      return sendError(res, 403, "Ce pool n'a pas été créé par vous");
    }
    if (await poolEstFige(pool.id)) {
      return sendError(res, 400, 'Ce pool est parti au laboratoire, il ne peut plus être supprimé');
    }
    // Supprimer une mère orphelinerait ses pools de 2e intention
    if (pool.PoolsFilles.length) {
      return sendError(res, 400, 'Ce pool a des pools de 2e intention : supprimez-les d’abord');
    }

    const echantillonIds = pool.TrichineEchantillons.map((echantillon) => echantillon.id);
    await prisma.trichineEchantillon.updateMany({
      where: { id: { in: echantillonIds } },
      data: { pool_id: null },
    });
    // Le pool n'est référencé que par des FTP brouillon : les liens n'ont plus d'objet
    await prisma.trichinePoolFTP.deleteMany({ where: { pool_id: pool.id } });
    await prisma.trichinePool.update({ where: { id: pool.id }, data: { deleted_at: new Date() } });
    await prisma.trichineAlias.deleteMany({ where: { pool_id: pool.id } });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      ancienStatut: pool.statut,
      nouveauStatut: pool.statut,
      userId: req.user.id,
      commentaire: `Suppression du pool ${pool.reference_pool}`,
    });
    for (const echantillonId of echantillonIds) {
      await recomputeEchantillonTrichine(echantillonId, req.user.id);
    }

    res.status(200).send({ ok: true, data: {}, error: '' });
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
  alias: aliasCreationSchema,
});

router.post(
  '/ftp',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = ftpSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, erreurParametres(bodyResult.error));
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
      include: {
        TrichinePoolFTPs: {
          include: { TrichineFTP: { select: { deleted_at: true, statut_logistique: true } } },
        },
      },
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
    // Une fiche supprimée ou annulée libère ses pools : ils repartent dans une nouvelle fiche
    const dejaEngage = pools.some((pool) =>
      pool.TrichinePoolFTPs.some(
        ({ TrichineFTP: autre }) =>
          !autre.deleted_at && autre.statut_logistique !== TrichineStatutLogistiqueFTP.ANNULEE
      )
    );
    if (dejaEngage) {
      return sendError(res, 400, 'Un des pools est déjà rattaché à une FTP');
    }
    const aliasACreer = await preparerAliases(
      req,
      TrichineAliasObjet.FTP,
      body.alias ? [body.alias] : [],
      body.expediteur_entity_id
    );
    if (aliasACreer.kind === 'error') {
      return sendError(res, 400, aliasACreer.error);
    }

    const entityCode = await referenceCodeForEntity(body.expediteur_entity_id, req.user.id);
    const ftp = await withReferenceRetry(async () =>
      prisma.trichineFTP.create({
        data: {
          numero_fiche: await nextFTPReference(entityCode),
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
    if (aliasACreer.entityId && body.alias) {
      await upsertAlias({
        entityId: aliasACreer.entityId,
        objetType: TrichineAliasObjet.FTP,
        objetId: ftp.id,
        reference: body.alias,
      });
    }

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
    // La fiche est archivée telle qu'envoyée, et part en pièce jointe : le labo l'a même
    // si le colis arrive sans son papier
    const pdf = await archiveFtpPdf(ftp.id, req.user.id);
    await notifyTrichineUsers({
      users: laboUsers,
      type: TrichineNotificationType.FTP_RECUE,
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      title: `Nouvelle FTP ${ftp.numero_fiche}`,
      message: `${req.user.prenom} ${req.user.nom_de_famille} vous a transmis la fiche de transmission des prélèvements ${ftp.numero_fiche} (${ftp.TrichinePoolFTPs.length} pool(s)). Connectez-vous à Zacharie pour la traiter.`,
      email: {
        subject: `Nouvelle fiche de transmission · FTP ${ftp.numero_fiche}`,
        tone: 'info',
        badge: 'Nouvelle FTP',
        heading: 'Des prélèvements vous ont été envoyés',
        intro: `${req.user.prenom} ${req.user.nom_de_famille} vous a transmis la fiche de transmission des prélèvements ${ftp.numero_fiche}, jointe à cet email. Les échantillons sont en route vers votre laboratoire.`,
        details: [
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
          { label: 'Expéditeur', value: `${req.user.prenom} ${req.user.nom_de_famille}` },
          {
            label: 'Pools',
            value: ftp.TrichinePoolFTPs.map((link) => link.TrichinePool.reference_pool).join(', '),
          },
        ],
        actions: [
          'À l’arrivée des échantillons, réceptionnez la fiche de transmission dans Zacharie.',
          'Saisissez ensuite le résultat de chaque pool, ou refusez-le s’il ne peut pas être analysé.',
        ],
      },
      notificationLogAction: `TRICHINE_FTP_ENVOYEE_${ftp.numero_fiche}`,
      attachments: pdf
        ? [{ content: pdf.toString('base64'), name: `FTP-${ftp.numero_fiche}.pdf` }]
        : undefined,
    });

    res.status(200).send({ ok: true, data: { ftp: updatedFtp }, error: '' });
  })
);

const ftpEditSchema = z.object({
  destinataire_entity_id: z.string().min(1).optional(),
  pool_ids: z.array(z.string().min(1)).min(1).optional(),
  mode_transport: z.string().optional(),
  commentaire: z.string().optional(),
});

router.put(
  '/ftp/:ftp_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = ftpEditSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, 'Paramètres invalides');
    }
    const body = bodyResult.data;

    const ftp = await prisma.trichineFTP.findUnique({ where: { id: req.params.ftp_id } });
    if (!ftp || ftp.deleted_at) {
      return sendError(res, 404, 'FTP introuvable');
    }
    if (ftp.expediteur_user_id !== req.user.id) {
      return sendError(res, 403, "Cette FTP n'a pas été créée par vous");
    }
    if (ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON) {
      return sendError(res, 400, 'Cette FTP est déjà partie, elle ne peut plus être modifiée');
    }

    let destinataireId = ftp.destinataire_entity_id;
    if (body.destinataire_entity_id && body.destinataire_entity_id !== ftp.destinataire_entity_id) {
      const destinataire = await prisma.entity.findUnique({ where: { id: body.destinataire_entity_id } });
      if (!destinataire || destinataire.deleted_at || destinataire.type !== EntityTypes.LABORATOIRE) {
        return sendError(res, 400, "Le destinataire n'est pas un laboratoire");
      }
      destinataireId = destinataire.id;
    }

    if (body.pool_ids) {
      const pools = await prisma.trichinePool.findMany({
        where: { id: { in: body.pool_ids } },
        include: { TrichinePoolFTPs: { include: { TrichineFTP: true } } },
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
      // Un pool déjà engagé dans une AUTRE fiche encore vivante ne peut pas être ajouté ici
      const dejaEngage = pools.some((pool) =>
        pool.TrichinePoolFTPs.some(
          ({ TrichineFTP: autre }) =>
            autre.id !== ftp.id &&
            !autre.deleted_at &&
            autre.statut_logistique !== TrichineStatutLogistiqueFTP.ANNULEE
        )
      );
      if (dejaEngage) {
        return sendError(res, 400, 'Un des pools est déjà rattaché à une autre FTP');
      }

      await prisma.trichinePoolFTP.deleteMany({
        where: { ftp_id: ftp.id, pool_id: { notIn: body.pool_ids } },
      });
      const existants = await prisma.trichinePoolFTP.findMany({ where: { ftp_id: ftp.id } });
      const dejaLies = new Set(existants.map((lien) => lien.pool_id));
      await prisma.trichinePoolFTP.createMany({
        data: body.pool_ids
          .filter((pool_id) => !dejaLies.has(pool_id))
          .map((pool_id) => ({ pool_id, ftp_id: ftp.id })),
      });
    }

    const updated = await prisma.trichineFTP.update({
      where: { id: ftp.id },
      data: {
        destinataire_entity_id: destinataireId,
        mode_transport: body.mode_transport ?? ftp.mode_transport,
        commentaire: body.commentaire ?? ftp.commentaire,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: ftp.statut_logistique,
      nouveauStatut: updated.statut_logistique,
      userId: req.user.id,
      commentaire: `Modification de la FTP ${ftp.numero_fiche}`,
    });
    await recomputeFTPTrichine(ftp.id, req.user.id);

    res.status(200).send({ ok: true, data: { ftp: updated }, error: '' });
  })
);

router.delete(
  '/ftp/:ftp_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: { TrichinePoolFTPs: { select: { pool_id: true } } },
    });
    if (!ftp || ftp.deleted_at) {
      return sendError(res, 404, 'FTP introuvable');
    }
    if (ftp.expediteur_user_id !== req.user.id) {
      return sendError(res, 403, "Cette FTP n'a pas été créée par vous");
    }
    if (ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON) {
      return sendError(res, 400, 'Cette FTP est déjà partie, elle ne peut plus être supprimée');
    }

    await prisma.trichineFTP.update({ where: { id: ftp.id }, data: { deleted_at: new Date() } });
    await prisma.trichineAlias.deleteMany({ where: { ftp_id: ftp.id } });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: ftp.statut_logistique,
      nouveauStatut: ftp.statut_logistique,
      userId: req.user.id,
      commentaire: `Suppression du brouillon ${ftp.numero_fiche}`,
    });
    // Les pools redeviennent libres, rattachables à une autre fiche
    for (const { pool_id } of ftp.TrichinePoolFTPs) {
      await recomputePoolTrichine(pool_id, req.user.id);
    }

    res.status(200).send({ ok: true, data: {}, error: '' });
  })
);

const annulerSchema = z.object({
  raison_annulation: z.string().min(1),
});

/**
 * Annulation d'une fiche déjà envoyée : le colis est parti mais le laboratoire ne l'a pas
 * encore réceptionné. La fiche reste tracée (statut ANNULEE + motif), le laboratoire est
 * prévenu au cas où le colis arrive quand même, et les pools redeviennent rattachables.
 */
router.post(
  '/ftp/:ftp_id/annuler',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const bodyResult = annulerSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 400, "La raison de l'annulation est obligatoire");
    }
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      include: { TrichinePoolFTPs: { select: { pool_id: true } } },
    });
    if (!ftp || ftp.deleted_at) {
      return sendError(res, 404, 'FTP introuvable');
    }
    if (ftp.expediteur_user_id !== req.user.id) {
      return sendError(res, 403, "Cette FTP n'a pas été créée par vous");
    }
    if (ftp.statut_logistique !== TrichineStatutLogistiqueFTP.ENVOYEE) {
      return sendError(
        res,
        400,
        ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON
          ? "Cette FTP n'est pas encore envoyée : supprimez-la"
          : 'Le laboratoire a déjà pris en charge cette FTP, elle ne peut plus être annulée'
      );
    }

    const updated = await prisma.trichineFTP.update({
      where: { id: ftp.id },
      data: {
        statut_logistique: TrichineStatutLogistiqueFTP.ANNULEE,
        date_annulation: new Date(),
        annulation_par_user_id: req.user.id,
        raison_annulation: bodyResult.data.raison_annulation,
      },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      ancienStatut: ftp.statut_logistique,
      nouveauStatut: updated.statut_logistique,
      userId: req.user.id,
      commentaire: `Annulation : ${bodyResult.data.raison_annulation}`,
    });
    // Les pools quittent l'état « en cours d'analyses » et redeviennent rattachables
    for (const { pool_id } of ftp.TrichinePoolFTPs) {
      await recomputePoolTrichine(pool_id, req.user.id);
    }

    const laboUsers = await getUsersWorkingForEntity(ftp.destinataire_entity_id);
    await notifyTrichineUsers({
      users: laboUsers,
      type: TrichineNotificationType.FTP_ANNULEE,
      objetType: TrichineObjetType.FTP,
      objetId: ftp.id,
      title: `FTP ${ftp.numero_fiche} annulée`,
      message: `${req.user.prenom} ${req.user.nom_de_famille} a annulé la fiche de transmission des prélèvements ${ftp.numero_fiche} : ${bodyResult.data.raison_annulation}. Si le colis vous parvient malgré tout, ne l'analysez pas.`,
      email: {
        subject: `FTP annulée · ${ftp.numero_fiche}`,
        tone: 'warning',
        badge: 'FTP annulée',
        heading: 'Une fiche de transmission a été annulée',
        intro: `${req.user.prenom} ${req.user.nom_de_famille} a annulé la fiche de transmission des prélèvements ${ftp.numero_fiche} avant sa prise en charge par votre laboratoire.`,
        details: [
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
          { label: 'Expéditeur', value: `${req.user.prenom} ${req.user.nom_de_famille}` },
          { label: 'Motif de l’annulation', value: bodyResult.data.raison_annulation },
        ],
        actions: [
          'Si le colis vous parvient malgré tout, ne l’analysez pas.',
          'Aucune autre action n’est requise de votre part.',
        ],
      },
      notificationLogAction: `TRICHINE_FTP_ANNULEE_${ftp.numero_fiche}`,
    });

    res.status(200).send({ ok: true, data: { ftp: updated }, error: '' });
  })
);

router.get(
  '/ftps',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftps = await prisma.trichineFTP.findMany({
      where: { expediteur_user_id: { in: await trichineEquipeUserIds(req.user) }, deleted_at: null },
      include: {
        DestinataireEntity: { select: { id: true, nom_d_usage: true, raison_sociale: true, is_lnr: true } },
        TrichinePoolFTPs: { include: { TrichinePool: true } },
        Documents: { where: { deleted_at: null } },
        ...trichineAliasesInclude,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).send({ ok: true, data: { ftps }, error: '' });
  })
);

router.get(
  '/ftp/:reference',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { numero_fiche: req.params.reference },
      include: {
        DestinataireEntity: {
          select: {
            id: true,
            nom_d_usage: true,
            raison_sociale: true,
            address_ligne_1: true,
            code_postal: true,
            ville: true,
            is_lnr: true,
          },
        },
        ExpediteurEntity: {
          select: { id: true, type: true, nom_d_usage: true, raison_sociale: true },
        },
        FTPParent: { select: { numero_fiche: true } },
        FTPChildren: { select: { numero_fiche: true, statut_logistique: true } },
        TrichinePoolFTPs: {
          include: {
            TrichinePool: {
              include: {
                TrichineEchantillons: {
                  where: { deleted_at: null },
                  include: { Carcasse: { select: carcasseProjectionSelect }, ...trichineAliasesInclude },
                  orderBy: { reference_echantillon: 'asc' },
                },
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
    if (!ftp || ftp.deleted_at || !(await trichineEquipeUserIds(req.user)).includes(ftp.expediteur_user_id)) {
      return sendError(res, 404, 'FTP introuvable');
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.FTP, objet_id: ftp.id },
      orderBy: { date_changement: 'desc' },
    });
    const etgs = await getEtgsDuServiceExpediteur(ftp.expediteur_entity_id);
    res.status(200).send({ ok: true, data: { ftp, historique, etgs }, error: '' });
  })
);

// Détail d'un échantillon (E-…)
router.get(
  '/echantillon/:reference',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const echantillon = await prisma.trichineEchantillon.findUnique({
      where: { reference_echantillon: req.params.reference },
      include: {
        Carcasse: { select: carcasseProjectionSelect },
        ...trichineAliasesInclude,
        RetireDuPool: { select: { reference_pool: true } },
        TrichinePool: {
          include: {
            TrichinePoolFTPs: {
              include: {
                TrichineFTP: {
                  include: {
                    DestinataireEntity: {
                      select: { id: true, nom_d_usage: true, raison_sociale: true, is_lnr: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !echantillon ||
      echantillon.deleted_at ||
      !(await trichineEquipeUserIds(req.user)).includes(echantillon.preleve_par_user_id)
    ) {
      return sendError(res, 404, 'Échantillon introuvable');
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.ECHANTILLON, objet_id: echantillon.id },
      orderBy: { date_changement: 'desc' },
    });
    res.status(200).send({ ok: true, data: { echantillon, historique }, error: '' });
  })
);

// Détail d'un pool (P-…) : c'est ici que vit le résultat d'analyse et sa provenance
router.get(
  '/pool/:reference',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const pool = await prisma.trichinePool.findUnique({
      where: { reference_pool: req.params.reference },
      include: {
        ...trichineAliasesInclude,
        TrichineEchantillons: {
          where: { deleted_at: null },
          include: { Carcasse: { select: carcasseProjectionSelect }, ...trichineAliasesInclude },
          orderBy: { reference_echantillon: 'asc' },
        },
        EchantillonsRetires: {
          where: { deleted_at: null },
          select: {
            id: true,
            reference_echantillon: true,
            retire_par_labo_at: true,
            retire_par_labo_motif: true,
            Carcasse: { select: { numero_bracelet: true } },
          },
          orderBy: { reference_echantillon: 'asc' },
        },
        TrichinePoolFTPs: {
          include: {
            TrichineFTP: {
              include: {
                DestinataireEntity: {
                  select: { id: true, nom_d_usage: true, raison_sociale: true, is_lnr: true },
                },
              },
            },
          },
        },
        PoolParent: { select: { reference_pool: true } },
        PoolsFilles: {
          where: { deleted_at: null },
          select: { reference_pool: true, statut: true, resultat_analyse: true },
        },
        Documents: { where: { deleted_at: null } },
      },
    });
    if (
      !pool ||
      pool.deleted_at ||
      !(await trichineEquipeUserIds(req.user)).includes(pool.cree_par_user_id)
    ) {
      return sendError(res, 404, 'Pool introuvable');
    }
    const historique = await prisma.trichineHistoriqueStatut.findMany({
      where: { objet_type: TrichineObjetType.POOL, objet_id: pool.id },
      orderBy: { date_changement: 'desc' },
    });
    res.status(200).send({ ok: true, data: { pool, historique }, error: '' });
  })
);

// PDF de la FTP à imprimer et joindre au colis (cf doc/trichine.md §12.1)
router.get(
  '/ftp/:ftp_id/pdf',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!guardEmitter(req, res)) return;
    const ftp = await prisma.trichineFTP.findUnique({
      where: { id: req.params.ftp_id },
      select: { numero_fiche: true, expediteur_user_id: true, deleted_at: true },
    });
    if (!ftp || ftp.deleted_at || !(await trichineEquipeUserIds(req.user)).includes(ftp.expediteur_user_id)) {
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
    const canView = (await carcassesAccessiblesAuSvi(req.user.id, [carcasse.zacharie_carcasse_id])).has(
      carcasse.zacharie_carcasse_id
    );
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
