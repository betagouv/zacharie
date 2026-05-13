import { FeiOwnerRole, UserRoles, type User } from '@prisma/client';
import dayjs from 'dayjs';
import departementsRegions from '~/data/departements-regions.json';

export const ALL_DEPARTEMENT_CODES: string[] = Object.keys(
  (departementsRegions as { departements: Record<string, string> }).departements
);

const ALL_DEPARTEMENT_CODES_SET = new Set(ALL_DEPARTEMENT_CODES);

/**
 * Liste par défaut à attribuer à un user FNC : tous les départements.
 * Permet de garder un comportement déclaratif (pas d'override par rôle au runtime).
 */
export function getDefaultScopeDepartementsForRoles(roles: UserRoles[]): string[] {
  if (roles.includes(UserRoles.FNC)) return [...ALL_DEPARTEMENT_CODES];
  return [];
}

/**
 * Si l'utilisateur prend le rôle FNC et n'a pas (encore) de scope explicite,
 * on remplit avec les 101 codes pour rester déclaratif (jamais "0 = tout").
 */
export function ensureScopeForRoles(
  currentScope: string[] | null | undefined,
  roles: UserRoles[]
): string[] | undefined {
  const current = currentScope ?? [];
  if (roles.includes(UserRoles.FNC) && current.length === 0) {
    return [...ALL_DEPARTEMENT_CODES];
  }
  return undefined;
}

export const circuitCourtRoles: FeiOwnerRole[] = [
  FeiOwnerRole.COMMERCE_DE_DETAIL,
  FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
  FeiOwnerRole.ASSOCIATION_CARITATIVE,
  FeiOwnerRole.CONSOMMATEUR_FINAL,
];

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

/**
 * Extrait le code département depuis le champ `Fei.commune_mise_a_mort`
 * (format attendu : "<code_postal> <COMMUNE>").
 *  - DOM/COM : 3 premiers chiffres (97x, 98x)
 *  - Corse : 2A si CP ≤ 20190, 2B sinon
 *  - Métropole : 2 premiers chiffres
 */
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

/**
 * Saison de chasse en cours (1er juillet → 30 juin).
 */
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

/**
 * Le périmètre est entièrement déclaratif : la seule source de vérité est
 * `user.scope_departements_codes`.
 *  - 0 département       → aucun accès (jamais "tout")
 *  - 1 département       → départemental
 *  - 101 départements    → national (équivalent à `null` pour le filtre)
 *  - sinon               → régional / multi-départemental
 *
 * Les rôles (FDC/FRC/FNC) ne court-circuitent plus la liste : le pré-remplissage
 * éventuel se fait à la création / au changement de rôle, pas à la lecture.
 */
export function resolveScope(user: User): {
  isNational: boolean;
  scopeDepts: string[] | null;
  scope: FederationScope;
} {
  const explicit = user.scope_departements_codes ?? [];
  const isNational =
    explicit.length === ALL_DEPARTEMENT_CODES.length &&
    explicit.every((c) => ALL_DEPARTEMENT_CODES_SET.has(c));
  // Le filtre côté stats traite `null` comme "pas de filtre" (= toutes les depts).
  // On renvoie `null` uniquement quand la liste explicite couvre tous les départements.
  const scopeDepts: string[] | null = isNational ? null : explicit;
  const scope: FederationScope = isNational
    ? 'national'
    : explicit.length === 1
      ? 'departemental'
      : 'regional';
  return { isNational, scopeDepts, scope };
}
