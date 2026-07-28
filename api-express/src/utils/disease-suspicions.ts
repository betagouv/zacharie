import { CarcasseType } from '@prisma/client';

/**
 * Détection de suspicions sanitaires sur la base des anomalies déclarées
 * par l'examinateur initial. Une "suspicion" n'implique aucune confirmation
 * vétérinaire — c'est un signal de veille terrain.
 *
 * Référentiel utilisé pour le mapping :
 *  - app-local-first-react-router/src/data/anomalies/gros.json
 *  - app-local-first-react-router/src/data/anomalies/petit.json
 *
 * Les anomalies sont stockées sous forme canonique « intitulé - famille » (ou « intitulé »
 * seul quand la famille n'a pas de site, cas du petit gibier). On compare donc des valeurs
 * EXACTES du référentiel, pas des fragments de texte : une reformulation du référentiel doit
 * casser bruyamment (cf. disease-suspicions.test.ts, qui vérifie que chaque constante ci-dessous
 * existe toujours) et non éteindre la détection en silence.
 *
 * Le rattachement anomalie → maladie vient des messages d'avertissement du référentiel
 * lui-même, qui nomment le risque (« risque tuberculose », « risque pestes porcines »…).
 */

export const PG_POILS_ESPECES = ['Lapins', 'Lièvres', 'Autres petits gibiers à poils'];

// --- Gros gibier -----------------------------------------------------------
// « risque tuberculose » : abcès sur les abats, ganglions volumineux.
const GG_ABATS_TUBERCULOSE = [
  'Abcès - Système respiratoire (trachée, poumons)',
  'Abcès - Système digestif (foie, intestins)',
  'Ganglions volumineux (intestins) - Système digestif (foie, intestins)',
];
// L'abcès vu à l'examen externe reste un signal tuberculose côté carcasse.
const GG_CARCASSE_TUBERCULOSE = ['Abcès unique - Externe'];

// « risque pestes porcines » : signes hémorragiques et cœur anormal.
const GG_ABATS_PESTE_PORCINE = [
  'Lésions hémorragiques - Système respiratoire (trachée, poumons)',
  'Lésions hémorragiques - Système digestif (foie, intestins)',
  'Cœur anormal - Système circulatoire (cœur)',
];

// --- Petit gibier ----------------------------------------------------------
// « risque tularémie » (lièvres).
const PG_CARCASSE_TULAREMIE = [
  'Abcès',
  "Déformation d'une ou plusieurs articulations",
  'Déformation de la tête',
];
// « risque brucellose » (petit gibier à poils).
const PG_CARCASSE_BRUCELLOSE = ['Testicules gonflés ou consistance anormale'];

export const REFERENTIEL_CANONICALS = {
  gros: [...GG_CARCASSE_TUBERCULOSE, ...GG_ABATS_TUBERCULOSE, ...GG_ABATS_PESTE_PORCINE],
  petit: [...PG_CARCASSE_TULAREMIE, ...PG_CARCASSE_BRUCELLOSE],
};

export interface CarcasseLike {
  type: CarcasseType | null;
  espece: string | null;
  examinateur_anomalies_carcasse: string[];
  examinateur_anomalies_abats: string[];
}

function anyOf(arr: string[] | null | undefined, canonicals: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  return arr.some((anomalie) => canonicals.includes(anomalie));
}

/**
 * Tuberculose bovine — grand gibier uniquement.
 * Carcasse : abcès à l'examen externe.
 * Abats : abcès sur les systèmes respiratoire / digestif, ganglions volumineux.
 */
export function matchTuberculose(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;

  return (
    anyOf(c.examinateur_anomalies_carcasse, GG_CARCASSE_TUBERCULOSE) ||
    anyOf(c.examinateur_anomalies_abats, GG_ABATS_TUBERCULOSE)
  );
}

/**
 * Pestes porcines — sanglier uniquement.
 * Abats : lésions hémorragiques (respiratoire ou digestif), cœur anormal — ce sont les
 * anomalies dont le référentiel dit « si sanglier […] risque pestes porcines ».
 */
export function matchPestePorcine(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;
  if (c.espece !== 'Sanglier') return false;

  return anyOf(c.examinateur_anomalies_abats, GG_ABATS_PESTE_PORCINE);
}

/**
 * Brucellose — petit gibier à poils uniquement : testicules gonflés ou de consistance anormale.
 *
 * Le grand gibier n'a plus de déclencheur : le référentiel ne décrit plus d'anomalie des
 * articulations ni de l'appareil génital (les familles « Système reproducteur (testicules) »
 * et « Système urinaire (reins) » du CSV sont vides). À rebrancher si elles sont renseignées.
 */
export function matchBrucellose(c: CarcasseLike): boolean {
  const isPgPoils = c.type === CarcasseType.PETIT_GIBIER && !!c.espece && PG_POILS_ESPECES.includes(c.espece);
  if (!isPgPoils) return false;

  return anyOf(c.examinateur_anomalies_carcasse, PG_CARCASSE_BRUCELLOSE);
}

/**
 * Tularémie — petit gibier (lièvres uniquement).
 * Abcès, déformation d'articulations, déformation de la tête.
 */
export function matchTularemie(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.PETIT_GIBIER) return false;
  if (c.espece !== 'Lièvres') return false;

  return anyOf(c.examinateur_anomalies_carcasse, PG_CARCASSE_TULAREMIE);
}
