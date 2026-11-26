import {
  TRICHINE_POOL_FILLE_MAX_CARCASSES,
  TRICHINE_POOL_MAX_CARCASSES,
  TRICHINE_POOL_MAX_MASSE_GRAMMES,
  TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES,
} from '@app/utils/trichine';

export type CarcasseAPrelever = { zacharie_carcasse_id: string; masse_grammes: number };

export type LimitesPool = {
  maxCarcasses: number;
  maxMasse?: number;
  minMasse?: number;
};

export const LIMITES_POOL_INITIAL: LimitesPool = {
  maxCarcasses: TRICHINE_POOL_MAX_CARCASSES,
  maxMasse: TRICHINE_POOL_MAX_MASSE_GRAMMES,
};

export const LIMITES_POOL_FILLE: LimitesPool = {
  maxCarcasses: TRICHINE_POOL_FILLE_MAX_CARCASSES,
};

export const LIMITES_POOL_PETITE_FILLE: LimitesPool = {
  maxCarcasses: 1,
  minMasse: TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES,
};

export function repartirEnPools(
  carcasses: Array<CarcasseAPrelever>,
  limites: LimitesPool = LIMITES_POOL_INITIAL
): Array<Array<string>> {
  const pools: Array<Array<string>> = [];
  let courant: Array<string> = [];
  let masseCourante = 0;

  for (const carcasse of carcasses) {
    const depasseNombre = courant.length + 1 > limites.maxCarcasses;
    const depasseMasse = !!limites.maxMasse && masseCourante + carcasse.masse_grammes > limites.maxMasse;
    if (courant.length > 0 && (depasseNombre || depasseMasse)) {
      pools.push(courant);
      courant = [];
      masseCourante = 0;
    }
    courant.push(carcasse.zacharie_carcasse_id);
    masseCourante += carcasse.masse_grammes;
  }
  if (courant.length) pools.push(courant);
  return pools;
}

export function erreurPool(
  masses: Array<number>,
  limites: LimitesPool = LIMITES_POOL_INITIAL
): string | null {
  if (masses.length > limites.maxCarcasses) {
    return `${masses.length} carcasses — maximum ${limites.maxCarcasses}`;
  }
  const masseTotale = masses.reduce((total, masse) => total + masse, 0);
  if (limites.maxMasse && masseTotale > limites.maxMasse) {
    return `${masseTotale} g — maximum ${limites.maxMasse} g`;
  }
  if (limites.minMasse && masseTotale < limites.minMasse) {
    return `${masseTotale} g — minimum ${limites.minMasse} g`;
  }
  return null;
}

export function repartirParGroupe(
  carcasses: Array<CarcasseAPrelever>,
  groupeDe: (carcasse: CarcasseAPrelever) => string,
  limites: LimitesPool = LIMITES_POOL_INITIAL
): Array<Array<string>> {
  const groupes = new Map<string, Array<CarcasseAPrelever>>();
  for (const carcasse of carcasses) {
    const cle = groupeDe(carcasse);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(carcasse);
  }
  return [...groupes.values()].flatMap((groupe) => repartirEnPools(groupe, limites));
}

export function repartirIndividuellement(carcasses: Array<CarcasseAPrelever>): Array<Array<string>> {
  return carcasses.map((carcasse) => [carcasse.zacharie_carcasse_id]);
}

export function reconcilierPools(
  pools: Array<Array<string>>,
  carcasses: Array<CarcasseAPrelever>,
  limites: LimitesPool = LIMITES_POOL_INITIAL
): Array<Array<string>> {
  const selectionnees = new Set(carcasses.map((carcasse) => carcasse.zacharie_carcasse_id));
  const dejaPlacees = new Set(pools.flat());
  const conserves = pools
    .map((pool) => pool.filter((carcasseId) => selectionnees.has(carcasseId)))
    .filter((pool) => pool.length > 0);
  const ajoutees = carcasses.filter((carcasse) => !dejaPlacees.has(carcasse.zacharie_carcasse_id));
  return [...conserves, ...repartirEnPools(ajoutees, limites)];
}
