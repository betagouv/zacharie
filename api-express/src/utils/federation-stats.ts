import {
  DepotType,
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  type Carcasse,
  type Entity,
} from '@prisma/client';
import dayjs from 'dayjs';
import departementsRegions from '~/data/departements-regions.json';
import prisma from '~/prisma';

export const ALL_DEPARTEMENT_CODES: string[] = Object.keys(
  (departementsRegions as { departements: Record<string, string> }).departements
).sort();

const ALL_DEPARTEMENT_CODES_SET = new Set(ALL_DEPARTEMENT_CODES);

const departementsLabels = (departementsRegions as { departements: Record<string, string> }).departements;
const regionsLabels = (departementsRegions as { regions: Record<string, string> }).regions;
const departementToRegion = (departementsRegions as { departementToRegion: Record<string, string> })
  .departementToRegion;

export const FEDERATION_ENTITY_TYPES: EntityTypes[] = [EntityTypes.FDC, EntityTypes.FRC, EntityTypes.FNC];

export function getAllFederationEntities(): Array<Prisma.EntityCreateManyInput> {
  const fnc: Prisma.EntityCreateManyInput = {
    id: 'federation-fnc',
    type: EntityTypes.FNC,
    raison_sociale: 'Fédération Nationale des Chasseurs',
    nom_d_usage: 'FNC',
    scope_departements_codes: [...ALL_DEPARTEMENT_CODES],
  };
  const frcs = Object.entries(regionsLabels).map(
    ([regionCode, regionLabel]): Prisma.EntityCreateManyInput => ({
      id: `federation-frc-${regionCode}`,
      type: EntityTypes.FRC,
      raison_sociale: `Fédération Régionale des Chasseurs – ${regionLabel}`,
      nom_d_usage: `FRC ${regionLabel}`,
      scope_departements_codes: ALL_DEPARTEMENT_CODES.filter(
        (departementCode) => departementToRegion[departementCode] === regionCode
      ),
    })
  );
  const fdcs = ALL_DEPARTEMENT_CODES.map(
    (departementCode): Prisma.EntityCreateManyInput => ({
      id: `federation-fdc-${departementCode}`,
      type: EntityTypes.FDC,
      raison_sociale: `Fédération Départementale des Chasseurs – ${departementsLabels[departementCode]}`,
      nom_d_usage: `FDC ${departementsLabels[departementCode]} (${departementCode})`,
      scope_departements_codes: [departementCode],
    })
  );
  return [fnc, ...frcs, ...fdcs];
}

export async function getUserFederationEntity(userId: string): Promise<Entity | null> {
  const relation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
      deleted_at: null,
      EntityRelatedWithUser: { type: { in: FEDERATION_ENTITY_TYPES }, deleted_at: null },
    },
    include: { EntityRelatedWithUser: true },
  });
  return relation?.EntityRelatedWithUser ?? null;
}

export function canAccessFederation(
  viewer: Pick<Entity, 'scope_departements_codes'>,
  target: Pick<Entity, 'scope_departements_codes'>
): boolean {
  const viewerDepts = new Set(viewer.scope_departements_codes ?? []);
  const targetDepts = target.scope_departements_codes ?? [];
  if (targetDepts.length === 0) return false;
  return targetDepts.every((code) => viewerDepts.has(code));
}

export async function getViewableFederationEntity(
  userId: string,
  targetFederationId: string | undefined
): Promise<Entity | null> {
  const federation = await getUserFederationEntity(userId);
  if (!federation) return null;
  if (!targetFederationId || targetFederationId === federation.id) return federation;
  const target = await prisma.entity.findFirst({
    where: { id: targetFederationId, type: { in: FEDERATION_ENTITY_TYPES }, deleted_at: null },
  });
  if (!target || !canAccessFederation(federation, target)) return null;
  return target;
}

export const circuitCourtRoles: FeiOwnerRole[] = [
  FeiOwnerRole.COMMERCE_DE_DETAIL,
  FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
  FeiOwnerRole.ASSOCIATION_CARITATIVE,
  FeiOwnerRole.CONSOMMATEUR_FINAL,
  FeiOwnerRole.CIRCUIT_COURT,
];

export type CircuitValorisation = 'agree' | 'nonAgree' | 'domestique';

export function getCircuitValorisation(
  carcasse: Pick<
    Carcasse,
    | 'consommateur_final_usage_domestique'
    | 'premier_detenteur_depot_type'
    | 'current_owner_role'
    | 'prev_owner_role'
    | 'next_owner_role'
  > & { CarcasseIntermediaire: Array<{ intermediaire_role: FeiOwnerRole | null }> }
): CircuitValorisation | null {
  if (carcasse.consommateur_final_usage_domestique != null) return 'domestique';
  const wasInEtg =
    carcasse.premier_detenteur_depot_type === DepotType.ETG ||
    carcasse.current_owner_role === FeiOwnerRole.ETG ||
    carcasse.current_owner_role === FeiOwnerRole.SVI ||
    carcasse.prev_owner_role === FeiOwnerRole.ETG ||
    carcasse.prev_owner_role === FeiOwnerRole.SVI ||
    carcasse.CarcasseIntermediaire.some((ci) => ci.intermediaire_role === FeiOwnerRole.ETG);
  if (wasInEtg) return 'agree';
  const destinataireRole = carcasse.next_owner_role ?? carcasse.current_owner_role;
  if (destinataireRole && circuitCourtRoles.includes(destinataireRole)) return 'nonAgree';
  return null;
}

export const BPH_PATTERNS = [
  "souillures d'origine digestive",
  "souillures d'origine digestive liées à une balle d'abdomen",
  'souillures telluriques',
  'odeur anormale',
  'putréfaction superficielle',
  'putréfaction profonde',
  'moisissures',
  'œufs ou larves de mouche',
  'morsure de chien',
  'conditions de préparation des viandes par le producteur primaire',
];

export function hasBphMotif(motifs: string[] | null): boolean {
  return (motifs ?? []).some((m) => {
    const s = m.toLowerCase();
    return BPH_PATTERNS.some((p) => s.includes(p));
  });
}

export function extractDepartementFromCommune(commune: string | null | undefined): string | null {
  if (!commune) return null;
  const cp = commune.trim().split(/\s+/)[0];
  if (!cp || cp.length < 2 || !/^\d/.test(cp)) return null;
  if (cp.startsWith('97') || cp.startsWith('98')) return cp.slice(0, 3);
  if (cp.startsWith('20')) {
    const num = parseInt(cp, 10);
    if (!Number.isFinite(num)) return null;
    return num <= 20190 ? '2A' : '2B';
  }
  return cp.slice(0, 2);
}

export function getCurrentSeason() {
  const now = dayjs();
  const seasonStartYear = now.month() >= 6 ? now.year() : now.year() - 1;
  const seasonEndYear = seasonStartYear + 1;
  const season = `${String(seasonStartYear).slice(-2)}-${String(seasonEndYear).slice(-2)}`;
  const seasonStart = dayjs(`${seasonStartYear}-07-01`).startOf('day');
  const seasonEnd = dayjs(`${seasonEndYear}-06-30`).endOf('day');
  return { season, seasonStart, seasonEnd };
}

export type FederationScope = 'national' | 'regional' | 'departemental';

export function resolveScope(federation: Pick<Entity, 'scope_departements_codes'>): {
  isNational: boolean;
  scopeDepts: string[] | null;
  scope: FederationScope;
} {
  const explicit = federation.scope_departements_codes ?? [];
  const isNational =
    explicit.length === ALL_DEPARTEMENT_CODES.length &&
    explicit.every((c) => ALL_DEPARTEMENT_CODES_SET.has(c));
  const scopeDepts: string[] | null = isNational ? null : explicit;
  const scope: FederationScope = isNational
    ? 'national'
    : explicit.length === 1
      ? 'departemental'
      : 'regional';
  return { isNational, scopeDepts, scope };
}
