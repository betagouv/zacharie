import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  TrichineAliasObjet,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  UserRoles,
  type User,
} from '@prisma/client';
import z from 'zod';
import prisma from '~/prisma';
import { isFtpPartie } from '~/utils/trichine';

/**
 * Références internes (alias) : chaque entité qui manipule un échantillon, un pool ou une FTP
 * (le SVI qui prélève, le LVD, le LNR) peut lui donner sa propre référence, celle de son LIMS ou
 * de son registre. Tous les acteurs qui voient l'objet voient ses alias.
 */

export const TRICHINE_ALIAS_MAX_LENGTH = 50;

// Lettres, chiffres, espace et quelques séparateurs usuels des références de laboratoire
export const aliasReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(TRICHINE_ALIAS_MAX_LENGTH)
  .regex(/^[\p{L}\p{N} ._\-/#()]+$/u);

export const ALIAS_REFERENCE_INVALIDE = `Référence invalide : ${TRICHINE_ALIAS_MAX_LENGTH} caractères maximum, lettres, chiffres, espaces et . _ - / # ( ) uniquement`;

export const trichineAliasSelect = {
  id: true,
  reference: true,
  entity_id: true,
  Entity: { select: { id: true, type: true, nom_d_usage: true, raison_sociale: true } },
} satisfies Prisma.TrichineAliasSelect;

// À poser dans l'include d'un échantillon, d'un pool ou d'une FTP
export const trichineAliasesInclude = {
  Aliases: { select: trichineAliasSelect, orderBy: { created_at: 'asc' } },
} satisfies Prisma.TrichinePoolInclude;

export type TrichineAliasProjection = Prisma.TrichineAliasGetPayload<{ select: typeof trichineAliasSelect }>;

/** Entités pour lesquelles l'utilisateur peut poser un alias : son SVI, ou son laboratoire. */
export async function aliasEntityIdsForUser(user: Pick<User, 'id' | 'roles'>): Promise<Array<string>> {
  const types: Array<EntityTypes> = [];
  if (user.roles.includes(UserRoles.SVI)) types.push(EntityTypes.SVI);
  if (user.roles.includes(UserRoles.LABORATOIRE)) types.push(EntityTypes.LABORATOIRE);
  if (!types.length) return [];
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
      EntityRelatedWithUser: { type: { in: types }, deleted_at: null },
    },
    select: { entity_id: true },
    orderBy: { created_at: 'asc' },
  });
  return relations.map((relation) => relation.entity_id);
}

/**
 * Gel côté SVI : ses références sont imprimées sur la FTP archivée à l'envoi et jointe au colis.
 * Une fois la fiche partie, elles ne doivent plus diverger du papier.
 * - FTP : figée dès qu'elle n'est plus en brouillon (envoyée, reçue, traitée ou annulée) ;
 * - pool / échantillon : figé dès qu'il est porté par une FTP partie (non annulée).
 */
export function aliasSviEstFige(
  objet:
    | { type: typeof TrichineAliasObjet.FTP; statut_logistique: TrichineStatutLogistiqueFTP }
    | {
        type: typeof TrichineAliasObjet.ECHANTILLON | typeof TrichineAliasObjet.POOL;
        ftps: Array<{ deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP }>;
      }
): boolean {
  if (objet.type === TrichineAliasObjet.FTP) {
    return objet.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON;
  }
  return objet.ftps.some((ftp) => isFtpPartie(ftp));
}

/**
 * Entité SVI au nom de laquelle poser l'alias : celle de l'objet quand l'agent en fait partie
 * (un agent peut travailler pour plusieurs services), sinon son premier service.
 */
export function entiteSviPourObjet(entityIds: Array<string>, objetEntityId: string | null | undefined) {
  return objetEntityId && entityIds.includes(objetEntityId) ? objetEntityId : entityIds[0];
}

/**
 * Gel côté laboratoire : une fois les analyses terminées (échantillon, pool) ou la fiche clôturée
 * (FTP), la référence a servi et ne bouge plus. Côté SVI, le gel intervient plus tôt, à l'envoi
 * de la FTP (cf `aliasSviEstFige`).
 */
export function aliasEstFige(
  objet:
    | {
        type: typeof TrichineAliasObjet.ECHANTILLON | typeof TrichineAliasObjet.POOL;
        statut: TrichineStatutAnalyse;
      }
    | {
        type: typeof TrichineAliasObjet.FTP;
        statut_logistique: TrichineStatutLogistiqueFTP;
        statut_analytique: TrichineStatutAnalyse;
      }
): boolean {
  if (objet.type === TrichineAliasObjet.FTP) {
    return (
      objet.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE ||
      objet.statut_logistique === TrichineStatutLogistiqueFTP.ANNULEE ||
      objet.statut_analytique === TrichineStatutAnalyse.ANALYSES_TERMINEES
    );
  }
  return objet.statut === TrichineStatutAnalyse.ANALYSES_TERMINEES;
}

const objetIdField = {
  [TrichineAliasObjet.ECHANTILLON]: 'echantillon_id',
  [TrichineAliasObjet.POOL]: 'pool_id',
  [TrichineAliasObjet.FTP]: 'ftp_id',
} as const;

const objetLabel = {
  [TrichineAliasObjet.ECHANTILLON]: "l'échantillon",
  [TrichineAliasObjet.POOL]: 'le pool',
  [TrichineAliasObjet.FTP]: 'la FTP',
} as const;

/**
 * Refuse une référence que l'entité a déjà donnée à un autre objet du même type, sans tenir
 * compte de la casse (« lims-12 » et « LIMS-12 » sont la même référence).
 * Renvoie le message d'erreur, ou null si la référence est libre.
 */
export async function aliasReferenceDejaPrise({
  entityId,
  objetType,
  objetId,
  reference,
}: {
  entityId: string;
  objetType: TrichineAliasObjet;
  objetId: string | null;
  reference: string;
}): Promise<string | null> {
  // Le filtre insensible à la casse de Prisma passe par ILIKE, où `_` vaut n'importe quel caractère :
  // on retient en mémoire la seule référence vraiment égale (« LIMS_12 » n'est pas « LIMS-12 »)
  const candidats = await prisma.trichineAlias.findMany({
    where: {
      entity_id: entityId,
      objet_type: objetType,
      reference: { equals: reference, mode: 'insensitive' },
    },
    select: {
      reference: true,
      echantillon_id: true,
      pool_id: true,
      ftp_id: true,
      TrichineEchantillon: { select: { reference_echantillon: true } },
      TrichinePool: { select: { reference_pool: true } },
      TrichineFTP: { select: { numero_fiche: true } },
    },
  });
  const existant = candidats.find((candidat) => candidat.reference.toLowerCase() === reference.toLowerCase());
  if (!existant || existant[objetIdField[objetType]] === objetId) return null;
  const autre =
    existant.TrichineEchantillon?.reference_echantillon ??
    existant.TrichinePool?.reference_pool ??
    existant.TrichineFTP?.numero_fiche;
  return `La référence « ${existant.reference} » est déjà utilisée pour ${objetLabel[objetType]} ${autre}`;
}

function objetFk(objetType: TrichineAliasObjet, objetId: string) {
  if (objetType === TrichineAliasObjet.ECHANTILLON) return { echantillon_id: objetId };
  if (objetType === TrichineAliasObjet.POOL) return { pool_id: objetId };
  return { ftp_id: objetId };
}

/** Retire l'alias de l'entité sur l'objet, s'il existe. */
export async function deleteAlias({
  entityId,
  objetType,
  objetId,
}: {
  entityId: string;
  objetType: TrichineAliasObjet;
  objetId: string;
}) {
  await prisma.trichineAlias.deleteMany({ where: { entity_id: entityId, ...objetFk(objetType, objetId) } });
}

export type UpsertAliasOutcome =
  | { kind: 'ok'; alias: TrichineAliasProjection }
  // Référence prise entre la vérification et l'écriture (saisie simultanée) : l'index unique tranche
  | { kind: 'conflit' };

/** Pose (ou remplace) l'alias de l'entité sur l'objet. La référence doit avoir été vérifiée. */
export async function upsertAlias({
  entityId,
  objetType,
  objetId,
  reference,
}: {
  entityId: string;
  objetType: TrichineAliasObjet;
  objetId: string;
  reference: string;
}): Promise<UpsertAliasOutcome> {
  const aliasDeLObjet = () =>
    prisma.trichineAlias.findFirst({
      where: { entity_id: entityId, ...objetFk(objetType, objetId) },
      select: { id: true },
    });
  const mettreAJour = async (id: string): Promise<UpsertAliasOutcome> => {
    try {
      const alias = await prisma.trichineAlias.update({
        where: { id },
        data: { reference },
        select: trichineAliasSelect,
      });
      return { kind: 'ok', alias };
    } catch (error) {
      // Seul l'index unique sur la référence peut rejeter la mise à jour
      if (isUniqueViolation(error)) return { kind: 'conflit' };
      throw error;
    }
  };

  const existant = await aliasDeLObjet();
  if (existant) return mettreAJour(existant.id);
  try {
    const alias = await prisma.trichineAlias.create({
      data: { entity_id: entityId, objet_type: objetType, ...objetFk(objetType, objetId), reference },
      select: trichineAliasSelect,
    });
    return { kind: 'ok', alias };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Création simultanée de l'alias de cette entité sur le même objet : on remplace sa référence
    const concurrent = await aliasDeLObjet();
    if (concurrent) return mettreAJour(concurrent.id);
    return { kind: 'conflit' };
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Vérifie une référence avant de la poser : format, puis unicité pour l'entité.
 * Renvoie le message d'erreur, ou null si elle peut être posée.
 */
export async function aliasReferenceRefusee({
  entityId,
  objetType,
  objetId,
  reference,
}: {
  entityId: string;
  objetType: TrichineAliasObjet;
  objetId: string | null;
  reference: string;
}): Promise<string | null> {
  if (!aliasReferenceSchema.safeParse(reference).success) return ALIAS_REFERENCE_INVALIDE;
  return aliasReferenceDejaPrise({ entityId, objetType, objetId, reference });
}

export const ALIAS_REFERENCE_CONFLIT = 'Cette référence vient d’être utilisée pour un autre objet';
