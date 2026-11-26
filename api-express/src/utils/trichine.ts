import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  User,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import queueSendNotificationToUser from '~/service/notifications';
import { capture } from '~/third-parties/sentry';
import { buildTrichineEmail, type TrichineEmailContent } from '~/templates/trichine-email';

export const TrichineActionRequise = {
  AUCUNE: 'AUCUNE',
  PRELEVEMENT_COMPLEMENTAIRE: 'PRELEVEMENT_COMPLEMENTAIRE',
  ANALYSE_EN_COURS_LVD: 'ANALYSE_EN_COURS_LVD',
  CONFIRMATION_EN_COURS_LNR: 'CONFIRMATION_EN_COURS_LNR',
} as const;
export type TrichineActionRequiseValue = (typeof TrichineActionRequise)[keyof typeof TrichineActionRequise];

export const TrichineDocumentType = {
  RAPPORT_COFRAC: 'RAPPORT_COFRAC',
  PHOTOGRAPHIE_LARVE: 'PHOTOGRAPHIE_LARVE',
  FTP_PDF: 'FTP_PDF',
  AUTRE: 'AUTRE',
} as const;

export const TrichineDocumentSource = {
  UPLOAD: 'UPLOAD',
} as const;

export const TrichineNotificationType = {
  RESULTAT_ANALYSE: 'RESULTAT_ANALYSE',
  FTP_RECUE: 'FTP_RECUE',
  POOL_REFUSE: 'POOL_REFUSE',
  FTP_ANNULEE: 'FTP_ANNULEE',
  CHANGEMENT_STATUT: 'CHANGEMENT_STATUT',
} as const;

export const TrichineObjetType = {
  CARCASSE: 'CARCASSE',
  ECHANTILLON: 'ECHANTILLON',
  POOL: 'POOL',
  FTP: 'FTP',
} as const;
export type TrichineObjetTypeValue = (typeof TrichineObjetType)[keyof typeof TrichineObjetType];

export const TRICHINE_ESPECE_CONCERNEE = 'Sanglier';

export const TRICHINE_POOL_INITIAL_MAX_CARCASSES = 19;
export const TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES = 100;
export const TRICHINE_POOL_FILLE_MAX_CARCASSES = 5;
export const TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES = 50;
export const TRICHINE_MASSE_DEFAUT_INITIAL = 5;
export const TRICHINE_MASSE_DEFAUT_COMPLEMENTAIRE = 20;
export const TRICHINE_MASSE_DEFAUT_CONFIRMATION = 50;

export const TRICHINE_ENTITY_CODE_PREFIX: Record<EntityTypes, string> = {
  [EntityTypes.PREMIER_DETENTEUR]: 'PD',
  [EntityTypes.COLLECTEUR_PRO]: 'CO',
  [EntityTypes.CCG]: 'CG',
  [EntityTypes.ETG]: 'EG',
  [EntityTypes.SVI]: 'SVI',
  [EntityTypes.COMMERCE_DE_DETAIL]: 'CD',
  [EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]: 'CR',
  [EntityTypes.ASSOCIATION_CARITATIVE]: 'AC',
  [EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]: 'RC',
  [EntityTypes.CONSOMMATEUR_FINAL]: 'CF',
  [EntityTypes.CIRCUIT_COURT]: 'CC',
  [EntityTypes.LABORATOIRE]: 'LAB',
  [EntityTypes.FDC]: 'FDC',
  [EntityTypes.FRC]: 'FRC',
  [EntityTypes.FNC]: 'FNC',
};

export function sanitizeEntityTrichineCode(code: string | null | undefined): string | null {
  const sanitized = (code ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  return sanitized || null;
}

export async function nextEntityTrichineCode(type: EntityTypes): Promise<string> {
  const prefix = TRICHINE_ENTITY_CODE_PREFIX[type];
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST(substring(code_trichine FROM '[0-9]+$') AS integer)) AS max
    FROM "Entity"
    WHERE code_trichine ~ ${`^${prefix}[0-9]+$`}
  `;
  return `${prefix}${String((rows[0]?.max ?? 0) + 1).padStart(2, '0')}`;
}

export function referenceEntityCode(
  entity: { code_trichine: string | null } | null,
  fallbackUserId: string
): string {
  return sanitizeEntityTrichineCode(entity?.code_trichine) ?? fallbackUserId.toUpperCase();
}

export async function referenceCodeForEntity(
  entityId: string | null | undefined,
  fallbackUserId: string
): Promise<string> {
  if (!entityId) return referenceEntityCode(null, fallbackUserId);
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { code_trichine: true },
  });
  return referenceEntityCode(entity, fallbackUserId);
}

export function nextReferenceFromLatest(
  prefix: 'E' | 'P' | 'F',
  yy: string,
  entityCode: string,
  latestReference: string | null
) {
  let next = 1;
  if (latestReference) {
    const seq = Number(latestReference.split('-')[3]);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}-${yy}-${entityCode}-${String(next).padStart(4, '0')}`;
}

function currentYY() {
  return String(new Date().getFullYear()).slice(-2);
}

export async function nextEchantillonReferences(entityCode: string, count: number): Promise<Array<string>> {
  const yy = currentYY();
  const latest = await prisma.trichineEchantillon.findFirst({
    where: { reference_echantillon: { startsWith: `E-${yy}-${entityCode}-` } },
    orderBy: { reference_echantillon: 'desc' },
    select: { reference_echantillon: true },
  });
  const references: Array<string> = [];
  let precedente = latest?.reference_echantillon ?? null;
  for (let index = 0; index < count; index++) {
    const reference = nextReferenceFromLatest('E', yy, entityCode, precedente);
    references.push(reference);
    precedente = reference;
  }
  return references;
}

export async function nextEchantillonReference(entityCode: string): Promise<string> {
  const [reference] = await nextEchantillonReferences(entityCode, 1);
  return reference;
}

export async function nextPoolReference(entityCode: string): Promise<string> {
  const yy = currentYY();
  const latest = await prisma.trichinePool.findFirst({
    where: { reference_pool: { startsWith: `P-${yy}-${entityCode}-` } },
    orderBy: { reference_pool: 'desc' },
    select: { reference_pool: true },
  });
  return nextReferenceFromLatest('P', yy, entityCode, latest?.reference_pool ?? null);
}

export async function nextFTPReference(entityCode: string): Promise<string> {
  const yy = currentYY();
  const latest = await prisma.trichineFTP.findFirst({
    where: { numero_fiche: { startsWith: `F-${yy}-${entityCode}-` } },
    orderBy: { numero_fiche: 'desc' },
    select: { numero_fiche: true },
  });
  return nextReferenceFromLatest('F', yy, entityCode, latest?.numero_fiche ?? null);
}

export async function withReferenceRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export function isFtpPartie(ftp: {
  deleted_at: Date | null;
  statut_logistique: TrichineStatutLogistiqueFTP;
}): boolean {
  if (ftp.deleted_at) return false;
  return (
    ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON &&
    ftp.statut_logistique !== TrichineStatutLogistiqueFTP.ANNULEE
  );
}

export async function logTrichineStatutChange({
  objetType,
  objetId,
  ancienStatut,
  nouveauStatut,
  userId,
  commentaire,
}: {
  objetType: TrichineObjetTypeValue;
  objetId: string;
  ancienStatut: string | null;
  nouveauStatut: string;
  userId: string;
  commentaire?: string;
}) {
  if ((ancienStatut ?? '') === nouveauStatut) return;
  await prisma.trichineHistoriqueStatut.create({
    data: {
      objet_type: objetType,
      objet_id: objetId,
      ancien_statut: ancienStatut ?? '',
      nouveau_statut: nouveauStatut,
      modifie_par_user_id: userId,
      commentaire,
    },
  });
}

export const trichineNotifiableUserSelect = {
  id: true,
  email: true,
  prenom: true,
  nom_de_famille: true,
  roles: true,
  notifications: true,
  web_push_tokens: true,
  native_push_tokens: true,
} satisfies Prisma.UserSelect;

export type TrichineNotifiableUser = Prisma.UserGetPayload<{ select: typeof trichineNotifiableUserSelect }>;

export async function getUsersWorkingForEntity(entityId: string): Promise<TrichineNotifiableUser[]> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      entity_id: entityId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
    },
    include: { UserRelatedWithEntity: { select: trichineNotifiableUserSelect } },
  });
  return relations.map((relation) => relation.UserRelatedWithEntity);
}

export async function getUserEntityIds(userId: string): Promise<Set<string>> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
    },
    select: { entity_id: true },
  });
  return new Set(relations.map((relation) => relation.entity_id));
}

const relationActiveAvecEntite: Prisma.EntityAndUserRelationsWhereInput = {
  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
  status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
  deleted_at: null,
};

export async function trichineEquipeUserIds(user: Pick<User, 'id' | 'roles'>): Promise<Array<string>> {
  if (!user.roles.includes(UserRoles.SVI)) return [user.id];
  const collegues = await prisma.entityAndUserRelations.findMany({
    where: {
      ...relationActiveAvecEntite,
      EntityRelatedWithUser: {
        type: EntityTypes.SVI,
        deleted_at: null,
        EntityRelationsWithUsers: { some: { ...relationActiveAvecEntite, owner_id: user.id } },
      },
    },
    select: { owner_id: true },
  });
  return [...new Set([user.id, ...collegues.map((relation) => relation.owner_id)])];
}

export async function userBelongsToEntity(userId: string, entityId: string): Promise<boolean> {
  const relation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: userId,
      entity_id: entityId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
    },
  });
  return !!relation;
}

const echantillonAvecPoolNegatif: Prisma.TrichineEchantillonWhereInput = {
  deleted_at: null,
  TrichinePool: {
    deleted_at: null,
    resultat_analyse: TrichineResultatAnalyse.NEGATIF,
  },
};

export const carcasseAvecTrichineNegatifFilter: Prisma.CarcasseWhereInput = {
  TrichineEchantillons: { some: echantillonAvecPoolNegatif },
};

export async function carcasseHasResultatTrichineNegatif(zacharieCarcasseId: string): Promise<boolean> {
  const echantillon = await prisma.trichineEchantillon.findFirst({
    where: { zacharie_carcasse_id: zacharieCarcasseId, ...echantillonAvecPoolNegatif },
    select: { id: true },
  });
  return !!echantillon;
}

export async function notifyTrichineUsers({
  users,
  type,
  objetType,
  objetId,
  title,
  message,
  email,
  notificationLogAction,
  excludeUserIds = [],
  attachments,
}: {
  users: TrichineNotifiableUser[];
  type: string;
  objetType: TrichineObjetTypeValue;
  objetId: string;
  title: string;
  message: string;
  email: TrichineEmailContent;
  notificationLogAction: string;
  excludeUserIds?: string[];
  attachments?: Array<{ content: string; name: string }>;
}) {
  const builtEmail = buildTrichineEmail(email);
  const seen = new Set<string>(excludeUserIds);
  for (const user of users) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    await prisma.trichineNotification.create({
      data: {
        utilisateur_id: user.id,
        type,
        objet_type: objetType,
        objet_id: objetId,
        message,
      },
    });
    void queueSendNotificationToUser({
      user: user as User,
      push: { title, body: message },
      title: builtEmail.subject,
      email: builtEmail.text,
      emailHtml: builtEmail.html,
      notificationLogAction,
      attachments,
    }).catch((error) => capture(error, { extra: { userId: user.id, notificationLogAction } }));
  }
}

export async function getFtpEmitterUsers(ftp: {
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

type PrelevementPoolInput = {
  resultat_analyse: TrichineResultatAnalyse | null;
  created_at: Date;
};

export function validateNouveauPrelevement({
  type,
  numeroBracelet,
  pools,
  aUnEchantillonSansPool,
}: {
  type: TrichineType;
  numeroBracelet: string | null;
  pools: PrelevementPoolInput[];
  aUnEchantillonSansPool: boolean;
}): string | null {
  const carcasse = `La carcasse ${numeroBracelet ?? ''}`.trim();

  if (type === TrichineType.COMPLEMENTAIRE) {
    if (!pools.some((pool) => pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX)) {
      return `${carcasse} n'appartient à aucun pool non négatif : un prélèvement complémentaire n'a pas lieu d'être`;
    }
    return null;
  }

  if (type === TrichineType.INITIAL) {
    if (aUnEchantillonSansPool) {
      return `${carcasse} porte déjà un échantillon en attente de regroupement`;
    }
    if (!pools.length) {
      return null;
    }
    const dernier = pools[pools.length - 1];
    if (dernier.resultat_analyse === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE) {
      return null;
    }
    return `${carcasse} a déjà été prélevée et son analyse suit son cours`;
  }

  return null;
}

type PoolEchantillonInput = {
  id: string;
  zacharie_carcasse_id: string;
  masse_grammes: number;
  type: TrichineType;
  pool_id: string | null;
  deleted_at: Date | null;
  retire_par_labo_at: Date | null;
};

type PoolParentInput = {
  id: string;
  pool_parent_id: string | null;
  resultat_analyse: TrichineResultatAnalyse | null;
  carcasseIds: string[];
  parentHasGrandParent: boolean;
};

export function validatePoolComposition({
  echantillons,
  parent,
  poolId,
}: {
  echantillons: PoolEchantillonInput[];
  parent: PoolParentInput | null;
  poolId?: string;
}): string | null {
  if (!echantillons.length) {
    return 'Un pool doit contenir au moins un échantillon';
  }
  if (echantillons.some((e) => e.deleted_at)) {
    return 'Un des échantillons a été supprimé';
  }
  if (echantillons.some((e) => e.pool_id && e.pool_id !== poolId)) {
    return 'Un des échantillons est déjà rattaché à un pool';
  }
  if (echantillons.some((e) => e.retire_par_labo_at)) {
    return 'Un des échantillons a été retiré de son pool par le laboratoire : la carcasse est à re-prélever';
  }
  const carcasseIds = new Set(echantillons.map((e) => e.zacharie_carcasse_id));
  if (carcasseIds.size !== echantillons.length) {
    return 'Un pool ne peut contenir qu’un échantillon par carcasse';
  }
  const masseTotale = echantillons.reduce((sum, e) => sum + e.masse_grammes, 0);

  const typeAttendu = parent ? TrichineType.COMPLEMENTAIRE : TrichineType.INITIAL;
  if (echantillons.some((e) => e.type !== typeAttendu)) {
    return parent
      ? 'Un pool de 2e intention ne peut contenir que des prélèvements complémentaires'
      : 'Un pool initial ne peut contenir que des prélèvements initiaux';
  }

  if (!parent) {
    if (carcasseIds.size > TRICHINE_POOL_INITIAL_MAX_CARCASSES) {
      return `Un pool initial ne peut pas contenir plus de ${TRICHINE_POOL_INITIAL_MAX_CARCASSES} carcasses`;
    }
    if (masseTotale > TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES) {
      return `Un pool initial ne peut pas dépasser ${TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES} g d’échantillons`;
    }
    return null;
  }

  if (parent.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX) {
    return 'Un pool complémentaire ne peut être créé qu’après un résultat non négatif du pool parent';
  }
  const horsParent = [...carcasseIds].filter((id) => !parent.carcasseIds.includes(id));
  if (horsParent.length) {
    return 'Toutes les carcasses du pool complémentaire doivent provenir du pool parent';
  }

  if (!parent.pool_parent_id) {
    if (carcasseIds.size > TRICHINE_POOL_FILLE_MAX_CARCASSES) {
      return `Un pool fille ne peut pas contenir plus de ${TRICHINE_POOL_FILLE_MAX_CARCASSES} carcasses du pool mère`;
    }
    return null;
  }

  if (parent.parentHasGrandParent) {
    return 'La hiérarchie des pools est limitée à mère / fille / petite-fille';
  }
  if (carcasseIds.size !== 1) {
    return 'Un pool petite-fille ne peut contenir qu’une seule carcasse';
  }
  if (masseTotale < TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES) {
    return `Un pool petite-fille requiert au moins ${TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES} g d’échantillon`;
  }
  return null;
}
