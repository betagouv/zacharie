import {
  TRICHINE_POOL_FILLE_MAX_CARCASSES,
  TRICHINE_POOL_MAX_CARCASSES,
  TRICHINE_POOL_MAX_MASSE_GRAMMES,
  TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES,
} from '@app/utils/trichine';

export type CarcasseAPrelever = { zacharie_carcasse_id: string; masse_grammes: number };

/**
 * Limites réglementaires d'un pool selon son rang (cf doc/trichine.md §9).
 * Un pool initial est plafonné, un pool petite-fille est au contraire planchonné :
 * une seule carcasse, mais 50 g d'échantillon pour l'isoler.
 */
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

/**
 * Répartition automatique d'un lot de prélèvements en pools réglementaires
 * (19 carcasses et 100 g maximum par pool initial, 4 carcasses par pool fille).
 * L'ordre d'entrée est conservé : la répartition reste prévisible, et l'utilisateur
 * peut ensuite déplacer une carcasse d'un pool à l'autre.
 */
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

/** Un pool dépasse-t-il une limite réglementaire ? Renvoie le message, ou null. */
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

/**
 * Un pool par groupe (le premier détenteur, par exemple). Les limites réglementaires
 * s'appliquent à l'intérieur de chaque groupe : un groupe trop gros est scindé en
 * plusieurs pools, mais deux groupes ne sont jamais mélangés.
 */
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

/** Un pool par carcasse : aucun résultat n'est mutualisé, chaque analyse est individuelle. */
export function repartirIndividuellement(carcasses: Array<CarcasseAPrelever>): Array<Array<string>> {
  return carcasses.map((carcasse) => [carcasse.zacharie_carcasse_id]);
}

/**
 * Aligne un agencement manuel sur la sélection courante : on retire les carcasses
 * désélectionnées et on répartit automatiquement celles qui viennent d'être ajoutées,
 * pour qu'un retour en arrière ne fasse pas perdre le travail de regroupement.
 */
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
