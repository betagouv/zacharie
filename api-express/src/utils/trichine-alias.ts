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
 * Un alias se fige avec l'objet : une fois les analyses terminées (échantillon, pool) ou la
 * fiche clôturée (FTP), la référence a servi et ne doit plus diverger des documents émis.
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
 * Refuse une référence que l'entité a déjà donnée à un autre objet du même type.
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
  const existant = await prisma.trichineAlias.findUnique({
    where: { entity_id_objet_type_reference: { entity_id: entityId, objet_type: objetType, reference } },
    select: {
      echantillon_id: true,
      pool_id: true,
      ftp_id: true,
      TrichineEchantillon: { select: { reference_echantillon: true } },
      TrichinePool: { select: { reference_pool: true } },
      TrichineFTP: { select: { numero_fiche: true } },
    },
  });
  if (!existant || existant[objetIdField[objetType]] === objetId) return null;
  const autre =
    existant.TrichineEchantillon?.reference_echantillon ??
    existant.TrichinePool?.reference_pool ??
    existant.TrichineFTP?.numero_fiche;
  return `La référence « ${reference} » est déjà utilisée pour ${objetLabel[objetType]} ${autre}`;
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
}) {
  const existant = await prisma.trichineAlias.findFirst({
    where: { entity_id: entityId, ...objetFk(objetType, objetId) },
    select: { id: true },
  });
  if (existant) {
    return prisma.trichineAlias.update({
      where: { id: existant.id },
      data: { reference },
      select: trichineAliasSelect,
    });
  }
  return prisma.trichineAlias.create({
    data: { entity_id: entityId, objet_type: objetType, ...objetFk(objetType, objetId), reference },
    select: trichineAliasSelect,
  });
}
