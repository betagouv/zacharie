import {
  EntityRelationStatus,
  EntityRelationType,
  Prisma,
  TrichineResultatAnalyse,
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

export const TrichineNotificationType = {
  RESULTAT_ANALYSE: 'RESULTAT_ANALYSE',
  FTP_RECUE: 'FTP_RECUE',
  POOL_REFUSE: 'POOL_REFUSE',
  CHANGEMENT_STATUT: 'CHANGEMENT_STATUT',
} as const;

export const TrichineObjetType = {
  CARCASSE: 'CARCASSE',
  ECHANTILLON: 'ECHANTILLON',
  POOL: 'POOL',
  FTP: 'FTP',
} as const;
export type TrichineObjetTypeValue = (typeof TrichineObjetType)[keyof typeof TrichineObjetType];

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
}: {
  users: TrichineNotifiableUser[];
  type: string;
  objetType: TrichineObjetTypeValue;
  objetId: string;
  title: string;
  message: string;
  notificationLogAction: string;
  excludeUserIds?: string[];
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

/* -------------------------------------------------------------------------- */
/* Validation de la composition d'un pool (cf doc/trichine.md §9)              */
/* -------------------------------------------------------------------------- */

type PoolEchantillonInput = {
  id: string;
  zacharie_carcasse_id: string;
  masse_grammes: number;
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
}: {
  echantillons: PoolEchantillonInput[];
  parent: PoolParentInput | null;
}): string | null {
  if (!echantillons.length) {
    return 'Un pool doit contenir au moins un échantillon';
  }
  if (echantillons.some((e) => e.deleted_at)) {
    return 'Un des échantillons a été supprimé';
  }
  if (echantillons.some((e) => e.pool_id)) {
    return 'Un des échantillons est déjà rattaché à un pool';
  }
  const carcasseIds = new Set(echantillons.map((e) => e.zacharie_carcasse_id));
  if (carcasseIds.size !== echantillons.length) {
    return 'Un pool ne peut contenir qu’un échantillon par carcasse';
  }
  const masseTotale = echantillons.reduce((sum, e) => sum + e.masse_grammes, 0);

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
