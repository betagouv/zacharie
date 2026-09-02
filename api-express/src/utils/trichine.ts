import {
  EntityRelationStatus,
  EntityRelationType,
  Prisma,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  User,
} from '@prisma/client';
import prisma from '~/prisma';
import queueSendNotificationToUser from '~/service/notifications';

/**
 * Valeurs conventionnelles des champs String évolutifs (cf doc/trichine.md §4.10).
 * Non typées en enum Postgres pour pouvoir itérer sans migration.
 */
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

// Un document est soit déposé dans l'app, soit reçu en pièce jointe sur l'adresse de dépôt
export const TrichineDocumentSource = {
  UPLOAD: 'UPLOAD',
  EMAIL: 'EMAIL',
} as const;
export type TrichineDocumentSourceValue =
  (typeof TrichineDocumentSource)[keyof typeof TrichineDocumentSource];

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

// Seule espèce soumise à la recherche de trichine dans Zacharie
export const TRICHINE_ESPECE_CONCERNEE = 'Sanglier';

// Contraintes réglementaires (UE 2015/1375, cf doc/trichine.md §9)
export const TRICHINE_POOL_INITIAL_MAX_CARCASSES = 19;
export const TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES = 100;
export const TRICHINE_POOL_FILLE_MAX_CARCASSES = 4;
export const TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES = 50;
export const TRICHINE_MASSE_DEFAUT_INITIAL = 5;
export const TRICHINE_MASSE_DEFAUT_COMPLEMENTAIRE = 20;
export const TRICHINE_MASSE_DEFAUT_CONFIRMATION = 50;

/* -------------------------------------------------------------------------- */
/* Références auto-générées : E-{YY}-{séquence} / P-{YY}-{séquence} / F-{YY}-{séquence} */
/* -------------------------------------------------------------------------- */

export function nextReferenceFromLatest(prefix: 'E' | 'P' | 'F', yy: string, latestReference: string | null) {
  let next = 1;
  if (latestReference) {
    const seq = Number(latestReference.split('-')[2]);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}-${yy}-${String(next).padStart(6, '0')}`;
}

function currentYY() {
  return String(new Date().getFullYear()).slice(-2);
}

/**
 * Réserve `count` références consécutives en une lecture : un prélèvement en lot crée
 * des dizaines d'échantillons, une lecture par échantillon serait inutilement coûteuse.
 * L'unicité reste garantie par la contrainte SQL + `withReferenceRetry`.
 */
export async function nextEchantillonReferences(count: number): Promise<Array<string>> {
  const yy = currentYY();
  const latest = await prisma.trichineEchantillon.findFirst({
    where: { reference_echantillon: { startsWith: `E-${yy}-` } },
    orderBy: { reference_echantillon: 'desc' },
    select: { reference_echantillon: true },
  });
  const references: Array<string> = [];
  let precedente = latest?.reference_echantillon ?? null;
  for (let index = 0; index < count; index++) {
    const reference = nextReferenceFromLatest('E', yy, precedente);
    references.push(reference);
    precedente = reference;
  }
  return references;
}

export async function nextEchantillonReference(): Promise<string> {
  const yy = currentYY();
  const latest = await prisma.trichineEchantillon.findFirst({
    where: { reference_echantillon: { startsWith: `E-${yy}-` } },
    orderBy: { reference_echantillon: 'desc' },
    select: { reference_echantillon: true },
  });
  return nextReferenceFromLatest('E', yy, latest?.reference_echantillon ?? null);
}

export async function nextPoolReference(): Promise<string> {
  const yy = currentYY();
  const latest = await prisma.trichinePool.findFirst({
    where: { reference_pool: { startsWith: `P-${yy}-` } },
    orderBy: { reference_pool: 'desc' },
    select: { reference_pool: true },
  });
  return nextReferenceFromLatest('P', yy, latest?.reference_pool ?? null);
}

export async function nextFTPReference(): Promise<string> {
  const yy = currentYY();
  const latest = await prisma.trichineFTP.findFirst({
    where: { numero_fiche: { startsWith: `F-${yy}-` } },
    orderBy: { numero_fiche: 'desc' },
    select: { numero_fiche: true },
  });
  return nextReferenceFromLatest('F', yy, latest?.numero_fiche ?? null);
}

/**
 * Deux créations concurrentes peuvent calculer la même référence : la contrainte
 * @unique lève alors un P2002 — on recalcule et on réessaie.
 */
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

/* -------------------------------------------------------------------------- */
/* Historique des statuts (audit réglementaire)                                */
/* -------------------------------------------------------------------------- */

/**
 * Une fiche « partie » : le colis a quitté l'émetteur et la fiche papier est dedans.
 * C'est le point de non-retour — tout ce qu'elle contient (pools, échantillons) est figé.
 * Un brouillon n'est pas encore parti ; une fiche annulée ne l'est plus.
 */
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

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

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

/** Entités pour lesquelles l'utilisateur peut agir (membre ou admin). */
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

/**
 * Vérifie que l'utilisateur travaille pour l'entité (membre ou admin).
 * À appeler systématiquement quand un entity_id arrive du client
 * (preleve_par_entity_id, cree_par_entity_id, expediteur_entity_id...).
 */
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

/**
 * Résultat négatif = seul résultat qui débloque une carcasse de sanglier :
 * acceptation par le SVI (§9) et auto-clôture J+10 (§6.2).
 */
const echantillonAvecPoolNegatif: Prisma.TrichineEchantillonWhereInput = {
  deleted_at: null,
  TrichinePool: {
    deleted_at: null,
    resultat_analyse: TrichineResultatAnalyse.NEGATIF,
  },
};

// Même règle, côté requête sur les carcasses
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

/**
 * Persiste une TrichineNotification par utilisateur + push/email immédiat.
 * `notificationLogAction` doit être unique par évènement (la table notificationLog
 * déduplique par user + action).
 */
export async function notifyTrichineUsers({
  users,
  type,
  objetType,
  objetId,
  title,
  message,
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
  notificationLogAction: string;
  excludeUserIds?: string[];
  attachments?: Array<{ content: string; name: string }>;
}) {
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
    await queueSendNotificationToUser({
      user: user as User,
      title,
      body: message,
      email: message,
      notificationLogAction,
      attachments,
    });
  }
}

/**
 * Destinataires actuels d'une liste de carcasses : 1ers détenteurs + détenteurs
 * actuels (user direct et/ou tous les utilisateurs de l'entité détentrice).
 */
export async function getCarcassesStakeholderUsers(
  carcasses: Array<{
    premier_detenteur_user_id: string | null;
    current_owner_user_id: string | null;
    current_owner_entity_id: string | null;
  }>
): Promise<TrichineNotifiableUser[]> {
  const userIds = new Set<string>();
  const entityIds = new Set<string>();
  for (const carcasse of carcasses) {
    if (carcasse.premier_detenteur_user_id) userIds.add(carcasse.premier_detenteur_user_id);
    if (carcasse.current_owner_user_id) userIds.add(carcasse.current_owner_user_id);
    if (carcasse.current_owner_entity_id) entityIds.add(carcasse.current_owner_entity_id);
  }
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] }, deleted_at: null },
        select: trichineNotifiableUserSelect,
      })
    : [];
  const entityUsers: TrichineNotifiableUser[] = [];
  for (const entityId of entityIds) {
    entityUsers.push(...(await getUsersWorkingForEntity(entityId)));
  }
  const byId = new Map<string, TrichineNotifiableUser>();
  for (const user of [...users, ...entityUsers]) byId.set(user.id, user);
  return [...byId.values()];
}

// Émetteur d'une FTP : l'utilisateur expéditeur + tous ceux de l'entité expéditrice
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

/* -------------------------------------------------------------------------- */
/* Légitimité d'un nouveau prélèvement (cf doc/trichine.md §5.1)               */
/* -------------------------------------------------------------------------- */

type PrelevementPoolInput = {
  resultat_analyse: TrichineResultatAnalyse | null;
  created_at: Date;
};

/**
 * Un prélèvement n'a de sens que pour ouvrir une analyse. On ne reprélève donc pas une
 * carcasse dont l'analyse est en cours ou rendue : soit c'est un complémentaire, et il lui
 * faut un pool douteux à resserrer, soit l'analyse précédente a été déclarée impossible.
 * Retourne un message d'erreur (français, montrable à l'utilisateur) ou null si valide.
 */
export function validateNouveauPrelevement({
  type,
  numeroBracelet,
  pools,
  aUnEchantillonSansPool,
}: {
  type: TrichineType;
  numeroBracelet: string | null;
  /** Pools actifs couvrant la carcasse, du plus ancien au plus récent */
  pools: PrelevementPoolInput[];
  /** La carcasse porte déjà un échantillon pas encore rattaché à un pool */
  aUnEchantillonSansPool: boolean;
}): string | null {
  const carcasse = `La carcasse ${numeroBracelet ?? ''}`.trim();

  if (type === TrichineType.COMPLEMENTAIRE) {
    if (!pools.some((pool) => pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX)) {
      return `${carcasse} n'appartient à aucun pool douteux : un prélèvement complémentaire n'a pas lieu d'être`;
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
    // Analyse impossible = analyse inexistante : on repart sur un prélèvement initial
    const dernier = pools[pools.length - 1];
    if (dernier.resultat_analyse === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE) {
      return null;
    }
    return `${carcasse} a déjà été prélevée et son analyse suit son cours`;
  }

  // CONFIRMATION : prélèvement à destination du LNR, hors parcours émetteur
  return null;
}

/* -------------------------------------------------------------------------- */
/* Validation de la composition d'un pool (cf doc/trichine.md §9)              */
/* -------------------------------------------------------------------------- */

type PoolEchantillonInput = {
  id: string;
  zacharie_carcasse_id: string;
  masse_grammes: number;
  type: TrichineType;
  pool_id: string | null;
  deleted_at: Date | null;
};

type PoolParentInput = {
  id: string;
  pool_parent_id: string | null;
  resultat_analyse: TrichineResultatAnalyse | null;
  carcasseIds: string[];
  // true si le parent du parent a lui-même un parent (profondeur > 2 interdite)
  parentHasGrandParent: boolean;
};

/** Retourne un message d'erreur (français, montrable à l'utilisateur) ou null si valide. */
export function validatePoolComposition({
  echantillons,
  parent,
  poolId,
}: {
  echantillons: PoolEchantillonInput[];
  parent: PoolParentInput | null;
  /** Pool en cours de modification : ses propres échantillons ne comptent pas comme déjà rattachés */
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
  const carcasseIds = new Set(echantillons.map((e) => e.zacharie_carcasse_id));
  if (carcasseIds.size !== echantillons.length) {
    return 'Un pool ne peut contenir qu’un échantillon par carcasse';
  }
  const masseTotale = echantillons.reduce((sum, e) => sum + e.masse_grammes, 0);

  // Le rang du pool et celui de ses échantillons vont de pair : un complémentaire ne se
  // regroupe qu'en 2e intention, un initial jamais.
  const typeAttendu = parent ? TrichineType.COMPLEMENTAIRE : TrichineType.INITIAL;
  if (echantillons.some((e) => e.type !== typeAttendu)) {
    return parent
      ? 'Un pool de 2e intention ne peut contenir que des prélèvements complémentaires'
      : 'Un pool initial ne peut contenir que des prélèvements initiaux';
  }

  if (!parent) {
    // Pool initial
    if (carcasseIds.size > TRICHINE_POOL_INITIAL_MAX_CARCASSES) {
      return `Un pool initial ne peut pas contenir plus de ${TRICHINE_POOL_INITIAL_MAX_CARCASSES} carcasses`;
    }
    if (masseTotale > TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES) {
      return `Un pool initial ne peut pas dépasser ${TRICHINE_POOL_INITIAL_MAX_MASSE_GRAMMES} g d’échantillons`;
    }
    return null;
  }

  // Pools complémentaires : uniquement après un résultat douteux du pool parent
  if (parent.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX) {
    return 'Un pool complémentaire ne peut être créé qu’après un résultat douteux du pool parent';
  }
  const horsParent = [...carcasseIds].filter((id) => !parent.carcasseIds.includes(id));
  if (horsParent.length) {
    return 'Toutes les carcasses du pool complémentaire doivent provenir du pool parent';
  }

  if (!parent.pool_parent_id) {
    // Pool fille (parent = pool initial)
    if (carcasseIds.size > TRICHINE_POOL_FILLE_MAX_CARCASSES) {
      return `Un pool fille ne peut pas contenir plus de ${TRICHINE_POOL_FILLE_MAX_CARCASSES} carcasses du pool mère`;
    }
    return null;
  }

  // Pool petite-fille (parent = pool fille)
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
