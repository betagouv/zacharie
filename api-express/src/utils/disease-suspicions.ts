import { CarcasseType } from '@prisma/client';

/**
 * Détection de suspicions sanitaires sur la base des anomalies déclarées
 * par l'examinateur initial. Une "suspicion" n'implique aucune confirmation
 * vétérinaire — c'est un signal de veille terrain.
 *
 * Référentiel utilisé pour le mapping :
 *  - app-local-first-react-router/src/data/grand-gibier-carcasse/list.json
 *  - app-local-first-react-router/src/data/grand-gibier-abats/list.json
 *  - app-local-first-react-router/src/data/petit-gibier-carcasse/list.json
 */

export const PG_POILS_ESPECES = ['Lapins', 'Lièvres', 'Autres petits gibiers à poils'];

interface CarcasseLike {
  type: CarcasseType | null;
  espece: string | null;
  examinateur_anomalies_carcasse: string[];
  examinateur_anomalies_abats: string[];
}

function normalize(s: string): string {
  return s.toLowerCase();
}

function anyContains(arr: string[] | null | undefined, ...patterns: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  const lows = arr.map(normalize);
  return patterns.some((p) => {
    const pn = normalize(p);
    return lows.some((s) => s.includes(pn));
  });
}

function allContains(arr: string[] | null | undefined, ...patterns: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  const lows = arr.map(normalize);
  return lows.some((s) => patterns.every((p) => s.includes(normalize(p))));
}

/**
 * Tuberculose bovine — grand gibier uniquement.
 * Carcasse : abcès ou nodules (uniques ou multiples).
 * Abats : abcès dans appareils respiratoire / digestif / génito-urinaire / rate,
 *         + anomalies estomac/intestin (consistance ou couleur).
 */
export function matchTuberculose(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;

  const carcasseHit = anyContains(c.examinateur_anomalies_carcasse, 'abcès ou nodules');

  const abatsAbces =
    allContains(c.examinateur_anomalies_abats, 'abcès ou nodules', 'appareil respiratoire') ||
    allContains(c.examinateur_anomalies_abats, 'abcès ou nodules', 'appareil digestif') ||
    allContains(c.examinateur_anomalies_abats, 'abcès ou nodules', 'appareil génito-urinaire') ||
    allContains(c.examinateur_anomalies_abats, 'abcès ou nodules', '(rate)');

  const abatsEstomac =
    allContains(c.examinateur_anomalies_abats, 'estomac/intestin', 'anomalies de consistance') ||
    allContains(c.examinateur_anomalies_abats, 'estomac/intestin', 'anomalies de couleur');

  return carcasseHit || abatsAbces || abatsEstomac;
}

/**
 * Pestes porcines — sanglier uniquement.
 * Carcasse : hémorragies multiples.
 * Abats : lésions hémorragiques (circulatoire), anomalies estomac/intestin,
 *         micro-hémorragies reins, anomalies rate (consistance / couleur).
 */
export function matchPestePorcine(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;
  if (c.espece !== 'Sanglier') return false;

  const carcasseHit = anyContains(c.examinateur_anomalies_carcasse, 'hémorragies multiples');

  const abatsHit =
    allContains(c.examinateur_anomalies_abats, 'appareil circulatoire', 'hémorragique') ||
    allContains(c.examinateur_anomalies_abats, 'estomac/intestin', 'anomalies de consistance') ||
    allContains(c.examinateur_anomalies_abats, 'estomac/intestin', 'anomalies de couleur') ||
    allContains(c.examinateur_anomalies_abats, 'micro hémorragies', 'rein') ||
    allContains(c.examinateur_anomalies_abats, 'micro-hémorragies', 'rein') ||
    allContains(c.examinateur_anomalies_abats, '(rate)', 'anomalies de consistance') ||
    allContains(c.examinateur_anomalies_abats, '(rate)', 'anomalies de couleur');

  return carcasseHit || abatsHit;
}

/**
 * Brucellose — grand gibier OU petit gibier à poils.
 * GG carcasse : déformation d'une ou plusieurs articulations.
 * GG abats : consistance anormalement ferme sur appareil génital.
 * PG : testicules gonflés OU consistance ferme des testicules.
 */
export function matchBrucellose(c: CarcasseLike): boolean {
  const isGg = c.type === CarcasseType.GROS_GIBIER;
  const isPgPoils = c.type === CarcasseType.PETIT_GIBIER && !!c.espece && PG_POILS_ESPECES.includes(c.espece);
  if (!isGg && !isPgPoils) return false;

  if (isGg) {
    const carcasseHit = anyContains(
      c.examinateur_anomalies_carcasse,
      "déformation d'une ou plusieurs articulations"
    );
    const abatsHit = allContains(
      c.examinateur_anomalies_abats,
      'appareil génital',
      'consistance anormalement ferme'
    );
    if (carcasseHit || abatsHit) return true;
  }

  if (isPgPoils) {
    const pgHit =
      anyContains(c.examinateur_anomalies_carcasse, 'testicules gonflés') ||
      allContains(c.examinateur_anomalies_carcasse, 'consistance anormalement ferme', 'testicules');
    if (pgHit) return true;
  }

  return false;
}

/**
 * Tularémie — petit gibier (lièvres uniquement).
 * Abcès uniques ou multiples, déformation d'articulations, déformation de la tête.
 */
export function matchTularemie(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.PETIT_GIBIER) return false;
  if (c.espece !== 'Lièvres') return false;

  return anyContains(
    c.examinateur_anomalies_carcasse,
    'abcès ou nodules',
    "déformation d'une ou plusieurs articulations",
    'déformation de la tête'
  );
}
