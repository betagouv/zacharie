import express from 'express';
import passport from 'passport';
import { CarcasseStatus, CarcasseType, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { Carcasse, CarcasseIntermediaire } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { RequestWithUser } from '~/types/request';
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';
import { getCarcasseStatusLabelForEmail } from '~/utils/get-carcasse-status';
import { getFicheExtraitPdfBuffer } from '~/templates/get-fiche-extrait-pdf';
import { fichePdfRateLimit } from '~/middlewares/fiche-pdf-rate-limit';

const router: express.Router = express.Router();

// Le rendu bloque le serveur (environ 2 s pour 500 carcasses, jusqu'à 5 s si tous les textes sont longs) :
// au-delà, pas de PDF.
export const MAX_CARCASSES_FICHE_PDF = 500;

// Les textes sont saisis librement, sans limite de longueur, et la durée du rendu suit le nombre de lignes
// du PDF : on les tronque (les motifs de refus prédéfinis font au plus 48 caractères).
export const LONGUEUR_MAX_TEXTE_FICHE_PDF = 60;
export function tronquer<T extends string | null>(texte: T): T {
  if (!texte) return texte;
  // par caractère complet : couper un emoji en deux fait planter le rendu du titre du PDF
  const caracteres = Array.from(texte);
  if (caracteres.length <= LONGUEUR_MAX_TEXTE_FICHE_PDF) return texte;
  return `${caracteres.slice(0, LONGUEUR_MAX_TEXTE_FICHE_PDF - 1).join('')}…` as T;
}

type IntermediairePdf = Pick<
  CarcasseIntermediaire,
  | 'intermediaire_id'
  | 'zacharie_carcasse_id'
  | 'intermediaire_entity_id'
  | 'intermediaire_role'
  | 'prise_en_charge_at'
  | 'decision_at'
  | 'nombre_d_animaux_acceptes'
  | 'ecarte_pour_inspection'
>;

// Décisions des intermédiaires : même libellé que la carte carcasse de l'écran ETG
// (get-carcasse-card-display.ts et CardCarcasse.tsx côté front). Sinon, le libellé du statut SVI.
function getStatutLabel(
  carcasse: Carcasse,
  dernierIntermediaire: IntermediairePdf | undefined,
  nomIntermediaire: string | null
) {
  const isPetitGibier = carcasse.type === CarcasseType.PETIT_GIBIER;
  if (carcasse.svi_carcasse_status === CarcasseStatus.REFUS_ETG_COLLECTEUR) {
    const refus = `${isPetitGibier ? 'Refusé' : 'Refusée'}${nomIntermediaire ? ` par ${nomIntermediaire}` : ''}`;
    const motif = tronquer(carcasse.intermediaire_carcasse_refus_motif);
    return motif ? `${refus} : ${motif}` : refus;
  }
  if (carcasse.svi_carcasse_status === CarcasseStatus.MANQUANTE_ETG_COLLECTEUR) {
    return `${isPetitGibier ? 'Manquant' : 'Manquante'}${nomIntermediaire ? ` pour ${nomIntermediaire}` : ''}`;
  }
  // Sans décision du SVI : seule la décision du dernier intermédiaire compte (un refus annulé repasse en
  // SANS_DECISION avec svi_carcasse_status_set_at posé, ce n'est pas une acceptation du SVI)
  if ((carcasse.svi_carcasse_status ?? CarcasseStatus.SANS_DECISION) === CarcasseStatus.SANS_DECISION) {
    if (dernierIntermediaire?.ecarte_pour_inspection) return 'Écarté pour inspection';
    if (dernierIntermediaire?.decision_at && dernierIntermediaire.intermediaire_role === FeiOwnerRole.ETG) {
      return `${isPetitGibier ? 'Accepté' : 'Acceptée'}${nomIntermediaire ? ` par ${nomIntermediaire}` : ''}`;
    }
    return 'Sans décision';
  }
  return getCarcasseStatusLabelForEmail(carcasse);
}

// Lot de petit gibier partiellement accepté par le dernier intermédiaire : « 7 sur 10 », comme à l'écran
function getNombreAnimaux(carcasse: Carcasse, dernierIntermediaire: IntermediairePdf | undefined) {
  const total = carcasse.nombre_d_animaux;
  if (total === null) return null;
  const acceptes = dernierIntermediaire?.nombre_d_animaux_acceptes ?? 0;
  if (carcasse.type === CarcasseType.PETIT_GIBIER && total > 1 && acceptes > 0) {
    return `${acceptes} sur ${total}`;
  }
  return `${total}`;
}

export function getFichePdfFilename(numero: string) {
  return `fiche-${numero.replace(/[^\w-]/g, '_')}.pdf`;
}

function getIntermediaireRoleLabel(role: FeiOwnerRole | null) {
  return role === FeiOwnerRole.COLLECTEUR_PRO ? 'Collecteur' : 'ETG';
}

// Extrait PDF d'une transmission de la fiche (premier détenteur → prochain détenteur) pour le SVI et
// l'ETG. Il reprend les carcasses que montre la page : celles du périmètre de lecture, plus celles
// refusées ou manquantes chez un intermédiaire, sorties de ce périmètre au moment du refus (même règle
// que GET /carcasse/refusees/:fei_numero).
router.get(
  '/:fei_numero/:premier_detenteur_prochain_detenteur_id_cache',
  passport.authenticate('user', { session: false }),
  fichePdfRateLimit,
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    if (!req.user.roles.includes(UserRoles.SVI) && !req.user.roles.includes(UserRoles.ETG)) {
      res.status(403).send({
        ok: false,
        data: null,
        error: 'Seuls les services vétérinaires et les ETG peuvent télécharger cette fiche',
      });
      return;
    }
    const accessWhere = await getCarcasseAccessWhere(req.user);
    if (!accessWhere) {
      res.status(403).send({ ok: false, data: null, error: "Vous n'avez pas les permissions." });
      return;
    }
    const feiNumero = req.params.fei_numero;
    const transmissionWhere: Prisma.CarcasseWhereInput = {
      fei_numero: feiNumero,
      premier_detenteur_prochain_detenteur_id_cache: req.params.premier_detenteur_prochain_detenteur_id_cache,
      deleted_at: null,
    };
    // Autorisation : au moins une carcasse de la transmission dans le périmètre de lecture
    const carcassesDansLePerimetre = await prisma.carcasse.count({
      where: { ...transmissionWhere, ...accessWhere },
    });
    const fei = carcassesDansLePerimetre
      ? await prisma.fei.findFirst({ where: { numero: feiNumero, deleted_at: null } })
      : null;
    if (!fei) {
      res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
      return;
    }

    const carcasses = await prisma.carcasse.findMany({
      where: {
        ...transmissionWhere,
        OR: [
          accessWhere,
          { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
          { intermediaire_carcasse_manquante: true },
        ],
      },
      orderBy: { numero_bracelet: 'asc' },
      take: MAX_CARCASSES_FICHE_PDF + 1,
    });
    if (carcasses.length > MAX_CARCASSES_FICHE_PDF) {
      res.status(413).send({
        ok: false,
        data: null,
        error: `Fiche trop volumineuse pour l'extrait PDF (plus de ${MAX_CARCASSES_FICHE_PDF} carcasses)`,
      });
      return;
    }

    const carcassesIntermediaires = await prisma.carcasseIntermediaire.findMany({
      where: {
        zacharie_carcasse_id: { in: carcasses.map((carcasse) => carcasse.zacharie_carcasse_id) },
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
      select: {
        intermediaire_id: true,
        zacharie_carcasse_id: true,
        intermediaire_entity_id: true,
        intermediaire_role: true,
        prise_en_charge_at: true,
        decision_at: true,
        nombre_d_animaux_acceptes: true,
        ecarte_pour_inspection: true,
      },
    });
    // Dernier intermédiaire de chaque carcasse (le plus récent), comme la carte carcasse à l'écran
    const dernierIntermediaireParCarcasse = new Map<string, IntermediairePdf>();
    for (const ci of carcassesIntermediaires) {
      dernierIntermediaireParCarcasse.set(ci.zacharie_carcasse_id, ci);
    }
    // Une ligne de traçabilité par intermédiaire, dans l'ordre de passage (created_at), comme à l'écran :
    // la date de prise en charge est saisie à la main et peut être antérieure à celle du précédent
    const intermediaires: Array<IntermediairePdf> = [];
    const intermediaireIdsVus = new Set<string>();
    for (const ci of carcassesIntermediaires) {
      if (intermediaireIdsVus.has(ci.intermediaire_id)) continue;
      intermediaireIdsVus.add(ci.intermediaire_id);
      intermediaires.push(ci);
    }

    const sviEntityId = carcasses.find((carcasse) => carcasse.svi_entity_id)?.svi_entity_id ?? null;
    const entityIds = [...new Set(carcassesIntermediaires.map((ci) => ci.intermediaire_entity_id))];
    if (sviEntityId) entityIds.push(sviEntityId);
    const entities = await prisma.entity.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, nom_d_usage: true },
    });
    const entityName = (id: string) =>
      tronquer(entities.find((entity) => entity.id === id)?.nom_d_usage ?? null);
    const examinateur = fei.examinateur_initial_user_id
      ? await prisma.user.findUnique({
          where: { id: fei.examinateur_initial_user_id },
          select: { prenom: true, nom_de_famille: true },
        })
      : null;

    const pdf = await getFicheExtraitPdfBuffer({
      numero: tronquer(fei.numero),
      dateMiseAMort: fei.date_mise_a_mort,
      communeMiseAMort: tronquer(fei.commune_mise_a_mort),
      examinateur: examinateur
        ? tronquer([examinateur.prenom, examinateur.nom_de_famille].filter(Boolean).join(' ') || null)
        : null,
      premierDetenteur: tronquer(carcasses[0].premier_detenteur_name_cache),
      intermediaires: intermediaires.map((intermediaire) => ({
        nom: entityName(intermediaire.intermediaire_entity_id) ?? '-',
        role: getIntermediaireRoleLabel(intermediaire.intermediaire_role),
        priseEnChargeAt: intermediaire.prise_en_charge_at,
      })),
      svi: sviEntityId ? entityName(sviEntityId) : null,
      carcasses: carcasses.map((carcasse) => {
        const dernierIntermediaire = dernierIntermediaireParCarcasse.get(carcasse.zacharie_carcasse_id);
        const nomIntermediaire = dernierIntermediaire
          ? entityName(dernierIntermediaire.intermediaire_entity_id)
          : null;
        return {
          numeroBracelet: tronquer(carcasse.numero_bracelet),
          espece: tronquer(carcasse.espece),
          nombreAnimaux: getNombreAnimaux(carcasse, dernierIntermediaire),
          statut: getStatutLabel(carcasse, dernierIntermediaire, nomIntermediaire),
        };
      }),
      genereLe: new Date(),
    });
    res.setHeader('Content-Type', 'application/pdf');
    // le numéro de fiche est créé par le client : on n'en garde que des caractères sûrs pour l'en-tête
    res.setHeader('Content-Disposition', `attachment; filename="${getFichePdfFilename(fei.numero)}"`);
    res.status(200).send(pdf);
  })
);

export default router;
