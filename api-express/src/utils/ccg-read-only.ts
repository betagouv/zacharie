import type { Carcasse, CarcasseIntermediaire, User } from '@prisma/client';
import prisma from '~/prisma';
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';

// Le propriétaire d'un CCG lit les fiches déposées dans son CCG jusqu'à leur sortie du CCG : la chasse,
// l'examen initial, le premier détenteur, le dépôt, puis qui a sorti la carcasse du CCG et quand.
// Jamais le devenir de la carcasse (refus, manquante, inspection SVI, saisie…).

const CARCASSE_CCG_FIELDS = new Set<keyof Carcasse>([
  'zacharie_carcasse_id',
  'numero_bracelet',
  'fei_numero',
  'date_mise_a_mort',
  'espece',
  'type',
  'nombre_d_animaux',
  'heure_mise_a_mort',
  'heure_evisceration',
  'heure_mise_a_mort_premiere_carcasse_fei',
  'heure_evisceration_derniere_carcasse_fei',
  'examinateur_carcasse_sans_anomalie',
  'examinateur_anomalies_carcasse',
  'examinateur_anomalies_abats',
  'examinateur_commentaire',
  'examinateur_signed_at',
  'premier_detenteur_depot_type',
  'premier_detenteur_depot_entity_id',
  'premier_detenteur_depot_entity_name_cache',
  'premier_detenteur_depot_ccg_at',
  'premier_detenteur_transport_type',
  'premier_detenteur_transport_date',
  'premier_detenteur_prochain_detenteur_role_cache',
  'premier_detenteur_prochain_detenteur_id_cache',
  'created_by_user_id',
  'examinateur_initial_offline',
  'examinateur_initial_user_id',
  'examinateur_initial_approbation_mise_sur_le_marche',
  'examinateur_initial_date_approbation_mise_sur_le_marche',
  'premier_detenteur_offline',
  'premier_detenteur_user_id',
  'premier_detenteur_entity_id',
  'premier_detenteur_name_cache',
  'created_at',
  'updated_at',
  'deleted_at',
  'is_synced',
  'version',
  'version_user_id',
]);

const INTERMEDIAIRE_CCG_FIELDS = new Set<keyof CarcasseIntermediaire>([
  'fei_numero',
  'numero_bracelet',
  'zacharie_carcasse_id',
  'intermediaire_id',
  'intermediaire_entity_id',
  'intermediaire_role',
  'intermediaire_user_id',
  'prise_en_charge_at',
  'created_at',
  'updated_at',
  'carcasse_updated_at',
  'deleted_at',
  'is_synced',
  'version',
  'version_user_id',
]);

// Champ hors liste : vidé (tableau vide, booléen non nullable à false, null sinon).
function keepOnly<T extends object>(item: T, fields: Set<keyof T>): T {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (fields.has(key as keyof T)) redacted[key] = value;
    else if (Array.isArray(value)) redacted[key] = [];
    else if (key === 'notifier_consommateur') redacted[key] = false;
    else redacted[key] = null;
  }
  return redacted as T;
}

export function redactCarcasseForCcg(carcasse: Carcasse): Carcasse {
  return keepOnly(carcasse, CARCASSE_CCG_FIELDS);
}

// Les intermédiaires d'une carcasse jusqu'à la sortie du CCG : ceux d'avant le dépôt, le déposant, puis
// celui qui l'a sortie du CCG (sans son dépôt ni son prochain détenteur). Les lignes supprimées sont
// gardées, vidées, pour que le client retire ses copies.
export function getCcgIntermediaires(
  carcasse: Pick<Carcasse, 'premier_detenteur_depot_entity_id'>,
  intermediaires: Array<CarcasseIntermediaire>,
  ccgIds: Array<string>
): Array<CarcasseIntermediaire> {
  const alive = intermediaires
    .filter((intermediaire) => !intermediaire.deleted_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const depositByPremierDetenteur =
    !!carcasse.premier_detenteur_depot_entity_id &&
    ccgIds.includes(carcasse.premier_detenteur_depot_entity_id);
  // -1 : dépôt par le premier détenteur, avant tout intermédiaire
  const depositIndex = depositByPremierDetenteur
    ? -1
    : alive.findIndex(
        (intermediaire) =>
          !!intermediaire.intermediaire_depot_entity_id &&
          ccgIds.includes(intermediaire.intermediaire_depot_entity_id)
      );
  const kept = !depositByPremierDetenteur && depositIndex === -1 ? [] : alive.slice(0, depositIndex + 2);
  const withDepot = new Set<keyof CarcasseIntermediaire>([
    ...INTERMEDIAIRE_CCG_FIELDS,
    'intermediaire_depot_type',
    'intermediaire_depot_entity_id',
  ]);
  return [
    ...kept.map((intermediaire, index) =>
      keepOnly(intermediaire, index <= depositIndex ? withDepot : INTERMEDIAIRE_CCG_FIELDS)
    ),
    ...intermediaires
      .filter((intermediaire) => intermediaire.deleted_at)
      .map((intermediaire) => keepOnly(intermediaire, INTERMEDIAIRE_CCG_FIELDS)),
  ];
}

// Carcasses d'une page du pull que l'utilisateur ne lit que comme propriétaire de CCG : hors de son
// périmètre de rôle, elles sont servies sans statut.
export async function getCcgOnlyCarcasseIds(
  user: User,
  userEntityIds: Array<string>,
  ccgIds: Array<string>,
  carcasses: Array<Pick<Carcasse, 'zacharie_carcasse_id'>>
): Promise<Set<string>> {
  if (!ccgIds.length || !carcasses.length) return new Set();
  const ids = carcasses.map((carcasse) => carcasse.zacharie_carcasse_id);
  const accessWhere = await getCarcasseAccessWhere(user, userEntityIds);
  const inRoleScope = accessWhere
    ? await prisma.carcasse.findMany({
        where: { AND: [{ zacharie_carcasse_id: { in: ids } }, accessWhere] },
        select: { zacharie_carcasse_id: true },
      })
    : [];
  const inRoleScopeIds = new Set(inRoleScope.map((carcasse) => carcasse.zacharie_carcasse_id));
  return new Set(ids.filter((id) => !inRoleScopeIds.has(id)));
}
